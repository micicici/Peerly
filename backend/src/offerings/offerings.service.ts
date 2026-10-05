import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { AppError } from '../common/app-error';
import { LedgerService } from '../ledger/ledger.service';
import { Slot } from '../slots/slot.entity';
import { User } from '../users/user.entity';
import { Offering, OfferingLevel } from './offering.entity';
import { canonicalSubjectName } from './subject-name';
import { Subject } from './subject.entity';

export type OfferingWrite = {
  title: string;
  description: string;
  level: OfferingLevel;
  subjectName?: string;
};

export type OfferingRecord = {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  level: OfferingLevel;
  createdAt: Date;
  subjectId: string | null;
  subjectName: string | null;
};

export type OfferingDto = OfferingRecord & {
  teacherName: string;
  openSlotCount: number;
  confirmedBookingCount: number;
};

/** Teaching offerings and the shared subject catalog. */
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
    @InjectRepository(Subject)
    private readonly subjects: Repository<Subject>,
    private readonly ledger: LedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async create(teacherId: string, dto: OfferingWrite): Promise<OfferingRecord> {
    if (!dto.subjectName) {
      throw new AppError('FORBIDDEN', 'Choose or type a subject', 400);
    }
    const subject = await this.ensureSubject(dto.subjectName);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Offering);
      const previous = await repo.count({ where: { teacherId } });
      const offering = await repo.save(
        repo.create({
          teacherId,
          title: dto.title,
          description: dto.description,
          level: dto.level,
          subjectId: subject.id,
        }),
      );
      if (previous === 0) {
        await this.ledger.insert(
          { userId: teacherId, amount: 3, type: 'starter' },
          manager,
        );
      }
      return this.toRecord(offering, subject.name);
    });
  }

  async listMine(teacherId: string): Promise<OfferingRecord[]> {
    const rows = await this.offerings.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
    return this.withSubjectNames(rows);
  }

  listSubjects(): Promise<{ id: string; name: string }[]> {
    return this.distinctSubjects();
  }

  async listBrowse(
    excludeTeacherId: string | undefined,
    q?: string,
    level?: OfferingLevel,
    languages: string[] = [],
    subjectIds: string[] = [],
  ): Promise<OfferingDto[]> {
    const qb = this.offerings
      .createQueryBuilder('o')
      .leftJoin(User, 'u', 'u.id = o.teacherId')
      .leftJoin(Subject, 's', 's.id = o.subjectId');
    if (excludeTeacherId) {
      qb.where('o.teacherId != :excludeTeacherId', { excludeTeacherId });
    }
    const query = q?.trim();
    if (query) {
      qb.andWhere(
        `(o.title ILIKE :q OR o.description ILIKE :q OR u.name ILIKE :q OR s.name ILIKE :q)`,
        { q: `%${query}%` },
      );
    }
    if (level) {
      qb.andWhere('o.level = :level', { level });
    }
    const languageKeys = [
      ...new Set(languages.map((language) => language.trim().toLowerCase())),
    ].filter(Boolean);
    if (languageKeys.length > 0) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM unnest(COALESCE(u."spokenLanguages", ARRAY[]::text[])) AS lang
          WHERE LOWER(lang) = ANY(:languageKeys)
        )`,
        { languageKeys },
      );
    }
    if (subjectIds.length > 0) {
      qb.andWhere('o.subjectId IN (:...subjectIds)', { subjectIds });
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
  ): Promise<OfferingRecord> {
    const offering = await this.findOwned(teacherId, id);
    if (dto.title !== undefined) offering.title = dto.title;
    if (dto.description !== undefined) offering.description = dto.description;
    if (dto.level !== undefined) offering.level = dto.level;
    let subjectName: string | null = null;
    if (dto.subjectName !== undefined) {
      const subject = await this.ensureSubject(dto.subjectName);
      offering.subjectId = subject.id;
      subjectName = subject.name;
    }
    const saved = await this.offerings.save(offering);
    if (!subjectName && saved.subjectId) {
      const subject = await this.subjects.findOne({
        where: { id: saved.subjectId },
      });
      subjectName = subject?.name ?? null;
    }
    return this.toRecord(saved, subjectName);
  }

  async remove(teacherId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const offering = await manager.findOne(Offering, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!offering || offering.teacherId !== teacherId) {
        throw new AppError('FORBIDDEN', 'Offering not found', 403);
      }
      const count = await manager.count(Offering, { where: { teacherId } });
      if (count < 2) {
        throw new AppError(
          'FORBIDDEN',
          'You must keep at least one offering',
          403,
        );
      }
      await manager.find(Slot, {
        where: { offeringId: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (await this.hasFutureConfirmedBooking(manager, id)) {
        throw new AppError('FORBIDDEN', 'Offering has upcoming bookings', 403);
      }
      await manager.delete(Slot, { offeringId: id, status: 'open' });
      await manager.delete(Offering, id);
    });
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
    const openSlotCount = await this.openSlotCounts(
      ids,
      rows.map((row) => row.teacherId),
    );
    const confirmedBookingCount = await this.confirmedBookingCounts(ids);
    const subjectNames = await this.subjectNameMap(rows);
    return rows.map((row) => ({
      ...this.toRecord(row, row.subjectId ? subjectNames.get(row.subjectId) ?? null : null),
      teacherName: names.get(row.teacherId) ?? '',
      openSlotCount: openSlotCount.get(row.id) ?? 0,
      confirmedBookingCount: confirmedBookingCount.get(row.id) ?? 0,
    }));
  }

  private async withSubjectNames(rows: Offering[]): Promise<OfferingRecord[]> {
    const subjectNames = await this.subjectNameMap(rows);
    return rows.map((row) =>
      this.toRecord(
        row,
        row.subjectId ? subjectNames.get(row.subjectId) ?? null : null,
      ),
    );
  }

  private async subjectNameMap(rows: Offering[]): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        rows
          .map((row) => row.subjectId)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (ids.length === 0) {
      return new Map();
    }
    const subjects = await this.subjects.find({ where: { id: In(ids) } });
    return new Map(subjects.map((subject) => [subject.id, subject.name]));
  }

  private toRecord(offering: Offering, subjectName: string | null): OfferingRecord {
    return {
      id: offering.id,
      teacherId: offering.teacherId,
      title: offering.title,
      description: offering.description,
      level: offering.level,
      createdAt: offering.createdAt,
      subjectId: offering.subjectId,
      subjectName,
    };
  }

  private async distinctSubjects(): Promise<{ id: string; name: string }[]> {
    const [linked, saved] = await Promise.all([
      this.subjects
        .createQueryBuilder('s')
        .innerJoin(Offering, 'o', 'o.subjectId = s.id')
        .select(['s.id', 's.name'])
        .distinct(true)
        .getMany(),
      this.subjects.find({
        select: { id: true, name: true },
      }),
    ]);
    const byId = new Map<string, { id: string; name: string }>();
    for (const subject of [...linked, ...saved]) {
      const name = subject.name?.trim();
      if (!subject.id || !name) {
        continue;
      }
      byId.set(subject.id, { id: subject.id, name });
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  private async ensureSubject(rawName: string): Promise<Subject> {
    const parsed = canonicalSubjectName(rawName);
    if (!parsed) {
      const trimmed = rawName.trim();
      throw new AppError(
        'FORBIDDEN',
        trimmed ? 'Subject name is too long' : 'Choose or type a subject',
        400,
      );
    }
    const { name, nameKey } = parsed;
    const existing = await this.subjects.findOne({ where: { nameKey } });
    if (existing) {
      return existing;
    }
    try {
      return await this.subjects.save(this.subjects.create({ name, nameKey }));
    } catch (err) {
      if (!this.isUniqueViolation(err)) {
        throw err;
      }
      const again = await this.subjects.findOne({ where: { nameKey } });
      if (!again) {
        throw err;
      }
      return again;
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err.driverError as { code?: string } | undefined)?.code === '23505'
    );
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
    teacherIds: string[],
  ): Promise<Map<string, number>> {
    if (teacherIds.length === 0) {
      return new Map();
    }
    const rows = await this.slots
      .createQueryBuilder('s')
      .select('s.teacherId', 'teacherId')
      .addSelect('COUNT(*)', 'count')
      .where('s.teacherId IN (:...teacherIds)', { teacherIds })
      .andWhere("s.status = 'open'")
      .andWhere('s.startAt > :now', { now: new Date() })
      .groupBy('s.teacherId')
      .getRawMany<{ teacherId: string; count: string }>();
    const byTeacher = new Map(
      rows.map((row) => [row.teacherId, Number(row.count)]),
    );
    const offerings = await this.offerings.find({
      where: { id: In(offeringIds) },
    });
    return new Map(
      offerings.map((row) => [row.id, byTeacher.get(row.teacherId) ?? 0]),
    );
  }

  private async hasFutureConfirmedBooking(
    manager: EntityManager,
    offeringId: string,
  ): Promise<boolean> {
    const rows: unknown[] = await manager.query(
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
