import { existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { LedgerService } from '../ledger/ledger.service';
import { MeetingsService } from '../meetings/meetings.service';
import { Offering } from '../offerings/offering.entity';
import { Subject } from '../offerings/subject.entity';
import { Slot } from '../slots/slot.entity';
import { User } from '../users/user.entity';
import { Booking, BookingStatus, LessonMaterial } from './booking.entity';
import { isClassroomJoinOpen } from './classroom-access';
import {
  LESSON_MATERIALS_ROOT,
  isSafeStoredName,
  materialFilePath,
  sanitizeOriginalName,
} from './lesson-materials';

const BOOKING_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClassroomAccess = {
  bookingId: string;
  role: 'teacher' | 'learner';
  startAt: Date;
  endAt: Date;
  peerName: string;
  offeringTitle: string;
};

export type PublicMaterial = {
  id: string;
  originalName: string;
};

export type MaterialFile = {
  path: string;
  mimeType: string;
  downloadName: string;
};

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
  offeringTitle: string;
  subjectName: string | null;
  teacherName: string;
  learnerName: string;
  materials: PublicMaterial[];
};

const MAX_MATERIALS = 8;

/** Confirms lessons, moves hour credits, and stores lesson files. */
@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Slot)
    private readonly slots: Repository<Slot>,
    @InjectRepository(Offering)
    private readonly offerings: Repository<Offering>,
    @InjectRepository(Subject)
    private readonly subjects: Repository<Subject>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly ledger: LedgerService,
    private readonly meetings: MeetingsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Books an open slot, spends one learner hour, and credits the teacher. */
  create(
    learnerId: string,
    slotId: string,
    offeringId: string,
  ): Promise<BookingView> {
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
      const offering = await manager.findOne(Offering, {
        where: { id: offeringId },
      });
      if (!offering || offering.teacherId !== slot.teacherId) {
        throw new AppError('FORBIDDEN', 'That subject is not taught here', 400);
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
          offeringId: offering.id,
          joinUrl,
          status: 'confirmed',
          materials: [],
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
      slot.offeringId = offering.id;
      await manager.save(slot);
      return this.decorate(booking, slot.startAt, manager);
    });
  }

  /** Teacher cancellation before the hour starts. Refunds the learner and reverses the teacher credit. */
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
      return this.decorate(booking, slot.startAt, manager);
    });
  }

  async classroomAccess(
    userId: string,
    bookingId: string,
  ): Promise<ClassroomAccess> {
    if (!BOOKING_ID.test(bookingId)) {
      throw new AppError('NOT_FOUND', 'Class not found', 404);
    }
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new AppError('NOT_FOUND', 'Class not found', 404);
    }
    if (booking.learnerId !== userId && booking.teacherId !== userId) {
      throw new AppError('FORBIDDEN', 'You are not in this class', 403);
    }
    if (booking.status !== 'confirmed') {
      throw new AppError('FORBIDDEN', 'This class was cancelled', 403);
    }
    const slot = await this.slots.findOne({ where: { id: booking.slotId } });
    if (!slot) {
      throw new AppError('NOT_FOUND', 'Class not found', 404);
    }
    if (!isClassroomJoinOpen(slot.startAt, slot.endAt, new Date(), booking.status)) {
      throw new AppError(
        'JOIN_NOT_OPEN',
        'You can join from 10 minutes before class until 10 minutes after it ends',
        403,
      );
    }
    const details = await this.detailsFor([booking]);
    const view = this.toView(booking, slot.startAt, details.get(booking.id));
    return {
      bookingId: booking.id,
      role: booking.teacherId === userId ? 'teacher' : 'learner',
      startAt: slot.startAt,
      endAt: slot.endAt,
      peerName:
        booking.teacherId === userId ? view.learnerName : view.teacherName,
      offeringTitle: view.offeringTitle,
    };
  }

  async attachMaterial(
    teacherId: string,
    bookingId: string,
    file: {
      originalName: string;
      storedName: string;
      mimeType: string;
      size: number;
    },
  ): Promise<PublicMaterial[]> {
    const booking = await this.bookingFor(bookingId);
    if (booking.teacherId !== teacherId) {
      throw new AppError('FORBIDDEN', 'Only the teacher can attach materials', 403);
    }
    if (booking.status !== 'confirmed') {
      throw new AppError('FORBIDDEN', 'This class was cancelled', 403);
    }
    if (!isSafeStoredName(file.storedName) || file.size <= 0) {
      throw new AppError('FORBIDDEN', 'That file type is not allowed', 400);
    }
    const current = booking.materials ?? [];
    if (current.length >= MAX_MATERIALS) {
      throw new AppError('FORBIDDEN', 'This class already has 8 materials', 400);
    }
    const material: LessonMaterial = {
      id: randomUUID(),
      originalName: sanitizeOriginalName(file.originalName),
      storedName: file.storedName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
    booking.materials = [...current, material];
    await this.bookings.save(booking);
    return publicMaterials(booking.materials);
  }

  async readMaterial(
    userId: string,
    bookingId: string,
    materialId: string,
  ): Promise<MaterialFile> {
    const booking = await this.bookingFor(bookingId);
    if (booking.teacherId !== userId && booking.learnerId !== userId) {
      throw new AppError('FORBIDDEN', 'You are not in this class', 403);
    }
    const material = (booking.materials ?? []).find((item) => item.id === materialId);
    if (!material) {
      throw new AppError('NOT_FOUND', 'Material not found', 404);
    }
    const path = materialFilePath(
      LESSON_MATERIALS_ROOT,
      booking.id,
      material.storedName,
    );
    if (!existsSync(path)) {
      throw new AppError('NOT_FOUND', 'Material not found', 404);
    }
    return {
      path,
      mimeType: material.mimeType || 'application/octet-stream',
      downloadName: sanitizeOriginalName(material.originalName),
    };
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
    const details = await this.detailsFor(bookings);
    return bookings.map((booking) =>
      this.toView(
        booking,
        starts.get(booking.slotId) ?? null,
        details.get(booking.id),
      ),
    );
  }

  private async decorate(
    booking: Booking,
    startAt: Date | null,
    manager: EntityManager,
  ): Promise<BookingView> {
    const details = await this.detailsFor([booking], manager);
    return this.toView(booking, startAt, details.get(booking.id));
  }

  private async detailsFor(
    bookings: Booking[],
    manager?: EntityManager,
  ): Promise<
    Map<
      string,
      {
        offeringTitle: string;
        subjectName: string | null;
        teacherName: string;
        learnerName: string;
      }
    >
  > {
    const offeringsRepo = manager
      ? manager.getRepository(Offering)
      : this.offerings;
    const subjectsRepo = manager
      ? manager.getRepository(Subject)
      : this.subjects;
    const usersRepo = manager ? manager.getRepository(User) : this.users;
    const offeringIds = [...new Set(bookings.map((booking) => booking.offeringId))];
    const offerings =
      offeringIds.length === 0
        ? []
        : await offeringsRepo.find({ where: { id: In(offeringIds) } });
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
        : await subjectsRepo.find({ where: { id: In(subjectIds) } });
    const personIds = [
      ...new Set(
        bookings.flatMap((booking) => [booking.teacherId, booking.learnerId]),
      ),
    ];
    const people =
      personIds.length === 0
        ? []
        : await usersRepo.find({ where: { id: In(personIds) } });
    const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]));
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject.name]));
    const nameMap = new Map(people.map((person) => [person.id, person.name]));
    return new Map(
      bookings.map((booking) => {
        const offering = offeringMap.get(booking.offeringId);
        return [
          booking.id,
          {
            offeringTitle: offering?.title ?? '',
            subjectName: offering?.subjectId
              ? (subjectMap.get(offering.subjectId) ?? null)
              : null,
            teacherName: nameMap.get(booking.teacherId) ?? '',
            learnerName: nameMap.get(booking.learnerId) ?? '',
          },
        ] as const;
      }),
    );
  }

  private toView(
    booking: Booking,
    startAt: Date | null,
    detail?: {
      offeringTitle: string;
      subjectName: string | null;
      teacherName: string;
      learnerName: string;
    },
  ): BookingView {
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
      offeringTitle: detail?.offeringTitle ?? '',
      subjectName: detail?.subjectName ?? null,
      teacherName: detail?.teacherName ?? '',
      learnerName: detail?.learnerName ?? '',
      materials: publicMaterials(booking.materials),
    };
  }

  private async bookingFor(bookingId: string): Promise<Booking> {
    if (!BOOKING_ID.test(bookingId)) {
      throw new AppError('NOT_FOUND', 'Class not found', 404);
    }
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new AppError('NOT_FOUND', 'Class not found', 404);
    }
    return booking;
  }
}

function publicMaterials(materials: LessonMaterial[] | null | undefined): PublicMaterial[] {
  return (materials ?? []).map((material) => ({
    id: material.id,
    originalName: material.originalName,
  }));
}
