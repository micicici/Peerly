import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { Offering } from '../offerings/offering.entity';
import { Slot } from './slot.entity';

const HOUR_MS = 60 * 60 * 1000;

/** One-hour teaching slots, aligned to the UTC hour. */
@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(Slot)
    private readonly slots: Repository<Slot>,
    private readonly dataSource: DataSource,
  ) {}

  /** Opens a future hour that does not overlap another active slot. */
  async create(teacherId: string, startAt: Date): Promise<Slot> {
    if (Number.isNaN(startAt.getTime()) || !this.isUtcHour(startAt)) {
      throw new AppError('SLOT_INVALID', 'Start must be on the UTC hour', 400);
    }
    if (startAt.getTime() <= Date.now()) {
      throw new AppError('SLOT_IN_PAST', 'Start is in the past', 400);
    }

    const endAt = new Date(startAt.getTime() + HOUR_MS);
    return this.dataSource.transaction(async (manager) => {
      const offeringCount = await manager.count(Offering, {
        where: { teacherId },
      });
      if (offeringCount < 1) {
        throw new AppError('OFFERING_REQUIRED', 'Publish an offering first', 403);
      }
      const repo = manager.getRepository(Slot);
      const clash = await repo
        .createQueryBuilder('s')
        .where('s.teacherId = :teacherId', { teacherId })
        .andWhere("s.status != 'cancelled'")
        .andWhere('s.startAt < :endAt AND s.endAt > :startAt', {
          startAt,
          endAt,
        })
        .getOne();
      if (clash) {
        throw new AppError(
          'SLOT_OVERLAP',
          'That hour overlaps another slot',
          409,
        );
      }
      return repo.save(
        repo.create({
          offeringId: null,
          teacherId,
          startAt,
          endAt,
          status: 'open',
        }),
      );
    });
  }

  async removeOpen(teacherId: string, slotId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const slot = await manager.findOne(Slot, {
        where: { id: slotId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!slot || slot.teacherId !== teacherId || slot.status !== 'open') {
        throw new AppError(
          'FORBIDDEN',
          'Only an open slot you own can be deleted',
          403,
        );
      }
      await manager.delete(Slot, slotId);
    });
  }

  async listOpenForOffering(offeringId: string): Promise<Slot[]> {
    const offering = await this.dataSource.getRepository(Offering).findOne({
      where: { id: offeringId },
    });
    if (!offering) {
      return [];
    }
    return this.listOpenForTeacher(offering.teacherId);
  }

  listOpenForTeacher(teacherId: string): Promise<Slot[]> {
    return this.slots.find({
      where: {
        teacherId,
        status: 'open',
        startAt: MoreThan(new Date()),
      },
      order: { startAt: 'ASC' },
    });
  }

  listScheduleForTeacher(teacherId: string): Promise<Slot[]> {
    const now = new Date();
    return this.slots.find({
      where: [
        { teacherId, status: 'open', startAt: MoreThan(now) },
        { teacherId, status: 'booked', startAt: MoreThan(now) },
      ],
      order: { startAt: 'ASC' },
    });
  }

  listMine(teacherId: string): Promise<Slot[]> {
    return this.slots.find({
      where: { teacherId },
      order: { startAt: 'ASC' },
    });
  }

  private isUtcHour(startAt: Date): boolean {
    return (
      startAt.getUTCMinutes() === 0 &&
      startAt.getUTCSeconds() === 0 &&
      startAt.getUTCMilliseconds() === 0
    );
  }
}
