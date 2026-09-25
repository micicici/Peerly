import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { LedgerService } from '../ledger/ledger.service';
import { MeetingsService } from '../meetings/meetings.service';
import { Slot } from '../slots/slot.entity';
import { Booking, BookingStatus } from './booking.entity';

export type BookingView = {
  id: string;
  slotId: string;
  learnerId: string;
  teacherId: string;
  offeringId: string;
  joinUrl: string;
  status: BookingStatus;
  createdAt: Date;
  startAt: Date | null;
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Slot)
    private readonly slots: Repository<Slot>,
    private readonly ledger: LedgerService,
    private readonly meetings: MeetingsService,
    private readonly dataSource: DataSource,
  ) {}

  create(learnerId: string, slotId: string): Promise<BookingView> {
    return this.dataSource.transaction(async (manager) => {
      const slot = await manager.findOne(Slot, {
        where: { id: slotId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!slot || slot.status !== 'open') {
        throw new AppError('SLOT_GONE', 'That hour was just taken.', 409);
      }
      if (slot.startAt <= new Date()) {
        throw new AppError('SLOT_IN_PAST', 'That hour is in the past.', 400);
      }
      if (slot.teacherId === learnerId) {
        throw new AppError('SELF_BOOK', 'You cannot book your own hour.', 400);
      }
      const balance = await this.ledger.balanceFor(learnerId, manager);
      if (balance < 1) {
        throw new AppError('INSUFFICIENT_HOURS', 'Not enough hours.', 400);
      }
      const joinUrl = this.meetings.createJoinUrl();
      if (!joinUrl) {
        throw new Error('Join URL is empty');
      }
      const repo = manager.getRepository(Booking);
      const booking = await repo.save(
        repo.create({
          slotId: slot.id,
          learnerId,
          teacherId: slot.teacherId,
          offeringId: slot.offeringId,
          joinUrl,
          status: 'confirmed',
        }),
      );
      await this.ledger.insert(
        {
          userId: learnerId,
          amount: -1,
          type: 'spend',
          bookingId: booking.id,
        },
        manager,
      );
      await this.ledger.insert(
        {
          userId: slot.teacherId,
          amount: 1,
          type: 'earn',
          bookingId: booking.id,
        },
        manager,
      );
      slot.status = 'booked';
      await manager.save(slot);
      return this.toView(booking, slot.startAt);
    });
  }

  cancelAsTeacher(teacherId: string, bookingId: string): Promise<BookingView> {
    return this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking || booking.teacherId !== teacherId) {
        throw new AppError('FORBIDDEN', 'Only the teacher can cancel', 403);
      }
      const slot = await manager.findOne(Slot, {
        where: { id: booking.slotId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !slot ||
        booking.status !== 'confirmed' ||
        new Date() >= slot.startAt
      ) {
        throw new AppError(
          'CANCEL_NOT_ALLOWED',
          'This booking can no longer be cancelled',
          400,
        );
      }
      booking.status = 'cancelled';
      slot.status = 'cancelled';
      await manager.save(booking);
      await manager.save(slot);
      await this.ledger.insert(
        {
          userId: booking.learnerId,
          amount: 1,
          type: 'refund',
          bookingId: booking.id,
        },
        manager,
      );
      await this.ledger.insert(
        {
          userId: booking.teacherId,
          amount: -1,
          type: 'reversal',
          bookingId: booking.id,
        },
        manager,
      );
      return this.toView(booking, slot.startAt);
    });
  }

  async listMine(userId: string): Promise<BookingView[]> {
    const bookings = await this.bookings.find({
      where: [{ learnerId: userId }, { teacherId: userId }],
      order: { createdAt: 'DESC' },
    });
    if (bookings.length === 0) {
      return [];
    }
    const slots = await this.slots.find({
      where: { id: In(bookings.map((booking) => booking.slotId)) },
    });
    const starts = new Map(slots.map((slot) => [slot.id, slot.startAt]));
    return bookings.map((booking) =>
      this.toView(booking, starts.get(booking.slotId) ?? null),
    );
  }

  private toView(booking: Booking, startAt: Date | null): BookingView {
    return {
      id: booking.id,
      slotId: booking.slotId,
      learnerId: booking.learnerId,
      teacherId: booking.teacherId,
      offeringId: booking.offeringId,
      joinUrl: booking.joinUrl,
      status: booking.status,
      createdAt: booking.createdAt,
      startAt,
    };
  }
}
