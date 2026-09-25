import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { Offering } from '../offerings/offering.entity';
import { Slot } from './slot.entity';

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class SlotsService {
  constructor(
    @InjectRepository(Slot)
    private readonly slots: Repository<Slot>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    teacherId: string,
    offeringId: string,
    startAt: Date,
  ): Promise<Slot> {
    if (Number.isNaN(startAt.getTime()) || !this.isUtcHour(startAt)) {
      throw new AppError('SLOT_INVALID', 'Start must be on the UTC hour', 400);
    }
    if (startAt.getTime() <= Date.now()) {
      throw new AppError('SLOT_IN_PAST', 'Start is in the past', 400);
    }

    const endAt = new Date(startAt.getTime() + HOUR_MS);
    return this.dataSource.transaction(async (manager) => {
      const offering = await manager.findOne(Offering, {
        where: { id: offeringId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!offering || offering.teacherId !== teacherId) {
        throw new AppError('FORBIDDEN', 'Offering not found', 403);
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
          offeringId,
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

  listOpenForOffering(offeringId: string): Promise<Slot[]> {
    return this.slots.find({
      where: {
        offeringId,
        status: 'open',
        startAt: MoreThan(new Date()),
      },
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
