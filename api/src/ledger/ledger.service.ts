import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LedgerEntry, LedgerType } from './ledger-entry.entity';

export type InsertLedgerInput = {
  userId: string;
  amount: number;
  type: LedgerType;
  bookingId?: string | null;
};

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly entries: Repository<LedgerEntry>,
  ) {}

  async balanceFor(userId: string, manager?: EntityManager): Promise<number> {
    const repo = this.repository(manager);
    const raw = await repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'sum')
      .where('e.userId = :userId', { userId })
      .getRawOne();
    return Number(raw.sum);
  }

  async insert(
    input: InsertLedgerInput,
    manager?: EntityManager,
  ): Promise<LedgerEntry> {
    const repo = this.repository(manager);
    const entry = repo.create({
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      bookingId: input.bookingId ?? null,
    });
    return repo.save(entry);
  }

  listFor(userId: string): Promise<LedgerEntry[]> {
    return this.entries.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private repository(manager?: EntityManager): Repository<LedgerEntry> {
    return manager ? manager.getRepository(LedgerEntry) : this.entries;
  }
}
