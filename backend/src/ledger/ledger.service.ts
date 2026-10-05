import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Offering } from '../offerings/offering.entity';
import { Subject } from '../offerings/subject.entity';
import { User } from '../users/user.entity';
import { LedgerEntry, LedgerType } from './ledger-entry.entity';

export type LedgerEntryView = {
  id: string;
  userId: string;
  amount: number;
  type: LedgerType;
  bookingId: string | null;
  createdAt: Date;
  subjectName: string | null;
  classTitle: string | null;
  counterpartName: string | null;
  counterpartRole: 'teacher' | 'student' | null;
  bookingStatus: BookingStatus | null;
  materials: { id: string; originalName: string }[];
};

export type InsertLedgerInput = {
  userId: string;
  amount: number;
  type: LedgerType;
  bookingId?: string | null;
};

/** Hour-credit ledger. A balance is the sum of that user's entries. */
@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly entries: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  /** Current balance. Locks the user's rows when called inside a transaction. */
  async balanceFor(userId: string, manager?: EntityManager): Promise<number> {
    const repo = this.repository(manager);
    if (manager) {
      await repo
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .where('e.userId = :userId', { userId })
        .orderBy('e.id', 'ASC')
        .getMany();
    }
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

  async listFor(userId: string): Promise<LedgerEntryView[]> {
    const entries = await this.entries.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const bookingIds = entries
      .map((entry) => entry.bookingId)
      .filter((id): id is string => id !== null);
    if (bookingIds.length === 0) {
      return entries.map((entry) => this.toView(entry, null, null, null, null, null, []));
    }
    const bookings = await this.dataSource.getRepository(Booking).find({
      where: { id: In(bookingIds) },
    });
    const offeringIds = [...new Set(bookings.map((booking) => booking.offeringId))];
    const offerings =
      offeringIds.length === 0
        ? []
        : await this.dataSource.getRepository(Offering).find({
            where: { id: In(offeringIds) },
          });
    const subjectIds = [
      ...new Set(
        offerings
          .map((offering) => offering.subjectId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const subjects =
      subjectIds.length === 0
        ? []
        : await this.dataSource.getRepository(Subject).find({
            where: { id: In(subjectIds) },
          });
    const personIds = [
      ...new Set(bookings.flatMap((booking) => [booking.teacherId, booking.learnerId])),
    ];
    const people = await this.dataSource.getRepository(User).find({
      where: { id: In(personIds) },
    });
    const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
    const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]));
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const nameMap = new Map(people.map((person) => [person.id, person.name]));
    return entries.map((entry) => {
      const booking = entry.bookingId ? bookingMap.get(entry.bookingId) : undefined;
      if (!booking) {
        return this.toView(entry, null, null, null, null, null, []);
      }
      const offering = offeringMap.get(booking.offeringId);
      const subjectName = offering?.subjectId
        ? (subjectMap.get(offering.subjectId) ?? null)
        : null;
      const counterpartRole =
        booking.teacherId === userId ? 'student' : 'teacher';
      const counterpartId =
        counterpartRole === 'student' ? booking.learnerId : booking.teacherId;
      return this.toView(
        entry,
        subjectName,
        offering?.title ?? null,
        nameMap.get(counterpartId) ?? null,
        counterpartRole,
        booking.status,
        (booking.materials ?? []).map((material) => ({
          id: material.id,
          originalName: material.originalName,
        })),
      );
    });
  }

  private toView(
    entry: LedgerEntry,
    subjectName: string | null,
    classTitle: string | null,
    counterpartName: string | null,
    counterpartRole: 'teacher' | 'student' | null,
    bookingStatus: BookingStatus | null,
    materials: { id: string; originalName: string }[],
  ): LedgerEntryView {
    return {
      id: entry.id,
      userId: entry.userId,
      amount: entry.amount,
      type: entry.type,
      bookingId: entry.bookingId,
      createdAt: entry.createdAt,
      subjectName,
      classTitle,
      counterpartName,
      counterpartRole,
      bookingStatus,
      materials,
    };
  }

  private repository(manager?: EntityManager): Repository<LedgerEntry> {
    return manager ? manager.getRepository(LedgerEntry) : this.entries;
  }
}
