import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { AppError } from '../common/app-error';
import { Slot } from '../slots/slot.entity';
import { User } from '../users/user.entity';
import { Review } from './review.entity';
import { reviewEligibility, ReviewDecision } from './review-eligibility';

/** Lesson ratings, eligibility checks, and teacher reports. */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Slot)
    private readonly slots: Repository<Slot>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async listForTeacher(teacherId: string) {
    const rows = await this.reviews.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
    const authors = await this.users.find({
      where: { id: In([...new Set(rows.map((r) => r.authorId))]) },
    });
    const names = new Map(authors.map((u) => [u.id, u.name]));
    return rows.map((row) => ({
      id: row.id,
      teacherId: row.teacherId,
      authorId: row.authorId,
      authorName: names.get(row.authorId) ?? 'Student',
      rating: row.rating,
      body: row.body,
      kind: row.kind,
      createdAt: row.createdAt,
    }));
  }

  async statsForTeachers(teacherIds: string[]) {
    const empty = new Map<
      string,
      { avgRating: number; ratingCount: number; completedCount: number }
    >();
    if (teacherIds.length === 0) {
      return empty;
    }
    const ratingRows = await this.reviews
      .createQueryBuilder('r')
      .select('r.teacherId', 'teacherId')
      .addSelect('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.teacherId IN (:...teacherIds)', { teacherIds })
      .groupBy('r.teacherId')
      .getRawMany<{ teacherId: string; avg: string; count: string }>();
    const completedRows = await this.bookings
      .createQueryBuilder('b')
      .innerJoin(Slot, 's', 's.id = b.slotId')
      .select('b.teacherId', 'teacherId')
      .addSelect('COUNT(*)', 'count')
      .where('b.teacherId IN (:...teacherIds)', { teacherIds })
      .andWhere("b.status = 'confirmed'")
      .andWhere('s.endAt < :now', { now: new Date() })
      .groupBy('b.teacherId')
      .getRawMany<{ teacherId: string; count: string }>();
    const completed = new Map(
      completedRows.map((r) => [r.teacherId, Number(r.count)]),
    );
    for (const id of teacherIds) {
      empty.set(id, {
        avgRating: 0,
        ratingCount: 0,
        completedCount: completed.get(id) ?? 0,
      });
    }
    for (const row of ratingRows) {
      const cur = empty.get(row.teacherId) ?? {
        avgRating: 0,
        ratingCount: 0,
        completedCount: completed.get(row.teacherId) ?? 0,
      };
      cur.avgRating = Number(row.avg);
      cur.ratingCount = Number(row.count);
      empty.set(row.teacherId, cur);
    }
    return empty;
  }

  popularityScore(stats: {
    avgRating: number;
    ratingCount: number;
    completedCount: number;
  }): number {
    return stats.completedCount * 2 + stats.avgRating * stats.ratingCount;
  }

  async pendingForLearner(learnerId: string) {
    const completed = await this.completedTeachers(learnerId);
    for (const teacherId of completed) {
      const reviews = await this.reviews.find({
        where: { authorId: learnerId, teacherId, kind: 'review' },
        order: { createdAt: 'DESC' },
      });
      if (reviews.length === 0) {
        const teacher = await this.users.findOne({ where: { id: teacherId } });
        return {
          teacherId,
          teacherName: teacher?.name ?? 'Teacher',
          required: true,
        };
      }
    }
    return null;
  }

  async eligibilityFor(
    authorId: string,
    teacherId: string,
  ): Promise<ReviewDecision> {
    return this.decide(authorId, teacherId);
  }

  async createReview(
    authorId: string,
    dto: { teacherId: string; rating: number; body: string; bookingId?: string },
  ) {
    const decision = await this.decide(authorId, dto.teacherId);
    if (!decision.canReview) {
      throw new AppError(
        decision.code,
        decision.reason ?? 'You cannot review this teacher',
        decision.code === 'REVIEW_TOO_SOON' ? 400 : 403,
      );
    }
    return this.reviews.save(
      this.reviews.create({
        authorId,
        teacherId: dto.teacherId,
        bookingId: dto.bookingId ?? null,
        rating: dto.rating,
        body: dto.body,
        kind: 'review',
      }),
    );
  }

  async createReport(authorId: string, dto: { teacherId: string; body: string }) {
    if (authorId === dto.teacherId) {
      throw new AppError('FORBIDDEN', 'You cannot report yourself', 403);
    }
    return this.reviews.save(
      this.reviews.create({
        authorId,
        teacherId: dto.teacherId,
        bookingId: null,
        rating: 1,
        body: `Report / Appeal: ${dto.body}`,
        kind: 'report',
      }),
    );
  }

  private async decide(
    authorId: string,
    teacherId: string,
  ): Promise<ReviewDecision> {
    if (authorId === teacherId) {
      return reviewEligibility({
        isSelf: true,
        hasCompletedClass: false,
        lastReviewAt: null,
        now: new Date(),
      });
    }
    const completed = await this.completedTeachers(authorId);
    const last = await this.reviews.findOne({
      where: { authorId, teacherId, kind: 'review' },
      order: { createdAt: 'DESC' },
    });
    return reviewEligibility({
      isSelf: false,
      hasCompletedClass: completed.includes(teacherId),
      lastReviewAt: last?.createdAt ?? null,
      now: new Date(),
    });
  }

  private async completedTeachers(learnerId: string): Promise<string[]> {
    const rows = await this.bookings
      .createQueryBuilder('b')
      .innerJoin(Slot, 's', 's.id = b.slotId')
      .select('DISTINCT b.teacherId', 'teacherId')
      .where('b.learnerId = :learnerId', { learnerId })
      .andWhere("b.status = 'confirmed'")
      .andWhere('s.endAt < :now', { now: new Date() })
      .getRawMany<{ teacherId: string }>();
    return rows.map((r) => r.teacherId);
  }
}
