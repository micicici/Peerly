import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { AppError } from '../common/app-error';
import { LedgerService } from '../ledger/ledger.service';
import { Slot } from '../slots/slot.entity';
import { User } from '../users/user.entity';
import { Offering, OfferingLevel } from './offering.entity';

export type OfferingWrite = {
  title: string;
  description: string;
  level: OfferingLevel;
};

export type OfferingDto = {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description: string;
  level: OfferingLevel;
  createdAt: Date;
  openSlotCount: number;
  confirmedBookingCount: number;
};

@Injectable()
export class OfferingsService {
  constructor(
    @InjectRepository(Offering)
    private readonly offerings: Repository<Offering>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Slot)
    private readonly slots: Repository<Slot>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async create(teacherId: string, dto: OfferingWrite): Promise<Offering> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Offering);
      const previous = await repo.count({ where: { teacherId } });
      const offering = await repo.save(
        repo.create({
          teacherId,
          title: dto.title,
          description: dto.description,
          level: dto.level,
        }),
      );
      if (previous === 0) {
        await this.ledger.insert(
          { userId: teacherId, amount: 3, type: 'starter' },
          manager,
        );
      }
      return offering;
    });
  }

  listMine(teacherId: string): Promise<Offering[]> {
    return this.offerings.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
  }

  async listBrowse(
    excludeTeacherId: string,
    q?: string,
    level?: OfferingLevel,
  ): Promise<OfferingDto[]> {
    const qb = this.offerings
      .createQueryBuilder('o')
      .where('o.teacherId != :excludeTeacherId', { excludeTeacherId });
    const query = q?.trim();
    if (query) {
      qb.andWhere('(o.title ILIKE :q OR o.description ILIKE :q)', {
        q: `%${query}%`,
      });
    }
    if (level) {
      qb.andWhere('o.level = :level', { level });
    }
    const rows = await qb.orderBy('o.createdAt', 'DESC').getMany();
    const dtos = await this.toDtos(rows);
    dtos.sort((a, b) => {
      if (b.confirmedBookingCount !== a.confirmedBookingCount) {
        return b.confirmedBookingCount - a.confirmedBookingCount;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return dtos;
  }

  async getById(id: string): Promise<OfferingDto> {
    const offering = await this.offerings.findOne({ where: { id } });
    if (!offering) {
      throw new AppError('FORBIDDEN', 'Offering not found', 404);
    }
    const [dto] = await this.toDtos([offering]);
    return dto;
  }

  async update(
    teacherId: string,
    id: string,
    dto: Partial<OfferingWrite>,
  ): Promise<Offering> {
    const offering = await this.findOwned(teacherId, id);
    if (dto.title !== undefined) offering.title = dto.title;
    if (dto.description !== undefined) offering.description = dto.description;
    if (dto.level !== undefined) offering.level = dto.level;
    return this.offerings.save(offering);
  }

  async remove(teacherId: string, id: string): Promise<void> {
    await this.findOwned(teacherId, id);
    const count = await this.countFor(teacherId);
    if (count < 2) {
      throw new AppError(
        'FORBIDDEN',
        'You must keep at least one offering',
        403,
      );
    }
    if (await this.hasFutureConfirmedBooking(id)) {
      throw new AppError('FORBIDDEN', 'Offering has upcoming bookings', 403);
    }
    await this.offerings.delete(id);
  }

  countFor(teacherId: string): Promise<number> {
    return this.offerings.count({ where: { teacherId } });
  }

  private async findOwned(teacherId: string, id: string): Promise<Offering> {
    const offering = await this.offerings.findOne({ where: { id } });
    if (!offering || offering.teacherId !== teacherId) {
      throw new AppError('FORBIDDEN', 'Offering not found', 403);
    }
    return offering;
  }

  private async toDtos(rows: Offering[]): Promise<OfferingDto[]> {
    if (rows.length === 0) {
      return [];
    }
    const teachers = await this.users.find({
      where: { id: In(rows.map((row) => row.teacherId)) },
    });
    const names = new Map(
      teachers.map((teacher) => [teacher.id, teacher.name]),
    );
    const ids = rows.map((row) => row.id);
    const openSlotCount = await this.openSlotCounts(ids);
    const confirmedBookingCount = await this.confirmedBookingCounts(ids);
    return rows.map((row) => ({
      id: row.id,
      teacherId: row.teacherId,
      teacherName: names.get(row.teacherId) ?? '',
      title: row.title,
      description: row.description,
      level: row.level,
      createdAt: row.createdAt,
      openSlotCount: openSlotCount.get(row.id) ?? 0,
      confirmedBookingCount: confirmedBookingCount.get(row.id) ?? 0,
    }));
  }

  private async confirmedBookingCounts(
    offeringIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.bookings
      .createQueryBuilder('b')
      .select('b.offeringId', 'offeringId')
      .addSelect('COUNT(*)', 'count')
      .where('b.offeringId IN (:...offeringIds)', { offeringIds })
      .andWhere("b.status = 'confirmed'")
      .groupBy('b.offeringId')
      .getRawMany<{ offeringId: string; count: string }>();
    return new Map(rows.map((row) => [row.offeringId, Number(row.count)]));
  }

  private async openSlotCounts(
    offeringIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.slots
      .createQueryBuilder('s')
      .select('s.offeringId', 'offeringId')
      .addSelect('COUNT(*)', 'count')
      .where('s.offeringId IN (:...offeringIds)', { offeringIds })
      .andWhere("s.status = 'open'")
      .andWhere('s.startAt > :now', { now: new Date() })
      .groupBy('s.offeringId')
      .getRawMany<{ offeringId: string; count: string }>();
    return new Map(rows.map((row) => [row.offeringId, Number(row.count)]));
  }

  private async hasFutureConfirmedBooking(
    offeringId: string,
  ): Promise<boolean> {
    const [reg] = await this.dataSource.query(
      `SELECT to_regclass('public.bookings') AS reg`,
    );
    if (!reg?.reg) {
      return false;
    }
    const [slotTable] = await this.dataSource.query(
      `SELECT to_regclass('public.slots') AS reg`,
    );
    if (!slotTable?.reg) {
      return false;
    }
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1
       FROM bookings b
       INNER JOIN slots s ON s.id = b."slotId"
       WHERE b."offeringId" = $1
         AND b.status = 'confirmed'
         AND s."startAt" > NOW()
       LIMIT 1`,
      [offeringId],
    );
    return rows.length > 0;
  }
}
