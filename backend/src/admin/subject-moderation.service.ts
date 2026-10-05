import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppError } from '../common/app-error';
import { Offering } from '../offerings/offering.entity';
import { canonicalSubjectName } from '../offerings/subject-name';
import { Subject } from '../offerings/subject.entity';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminSubjectView = {
  id: string;
  name: string;
  offeringCount: number;
  createdAt: Date;
};

/** Admin operations on the subject catalog: rename, merge, and delete. */
@Injectable()
export class SubjectModerationService {
  constructor(
    @InjectRepository(Subject)
    private readonly subjects: Repository<Subject>,
    @InjectRepository(Offering)
    private readonly offerings: Repository<Offering>,
    private readonly dataSource: DataSource,
  ) {}

  async list(): Promise<AdminSubjectView[]> {
    const subjects = await this.subjects.find({ order: { name: 'ASC' } });
    const counts = await this.offeringCounts(subjects.map((subject) => subject.id));
    return subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      offeringCount: counts.get(subject.id) ?? 0,
      createdAt: subject.createdAt,
    }));
  }

  rename(id: string, rawName: string): Promise<AdminSubjectView> {
    this.assertId(id);
    const parsed = canonicalSubjectName(rawName);
    if (!parsed) {
      throw new AppError(
        'FORBIDDEN',
        rawName.trim() ? 'Subject name is too long' : 'Enter a subject name',
        400,
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const subject = await manager.findOne(Subject, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!subject) {
        throw new AppError('NOT_FOUND', 'Subject not found', 404);
      }
      const clash = await manager.findOne(Subject, {
        where: { nameKey: parsed.nameKey },
      });
      if (clash && clash.id !== subject.id) {
        throw new AppError(
          'SUBJECT_EXISTS',
          'A subject with that name already exists. Merge them instead.',
          409,
        );
      }
      subject.name = parsed.name;
      subject.nameKey = parsed.nameKey;
      await manager.save(subject);
      const offeringCount = await manager.count(Offering, {
        where: { subjectId: id },
      });
      return this.toView(subject, offeringCount);
    });
  }

  merge(sourceId: string, targetId: string): Promise<AdminSubjectView> {
    this.assertId(sourceId);
    this.assertId(targetId);
    if (sourceId === targetId) {
      throw new AppError(
        'FORBIDDEN',
        'Choose a different subject to merge into',
        400,
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const source = await manager.findOne(Subject, {
        where: { id: sourceId },
        lock: { mode: 'pessimistic_write' },
      });
      const target = await manager.findOne(Subject, {
        where: { id: targetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!source || !target) {
        throw new AppError('NOT_FOUND', 'Subject not found', 404);
      }
      await manager.update(
        Offering,
        { subjectId: sourceId },
        { subjectId: targetId },
      );
      await manager.delete(Subject, sourceId);
      const offeringCount = await manager.count(Offering, {
        where: { subjectId: targetId },
      });
      return this.toView(target, offeringCount);
    });
  }

  async remove(id: string): Promise<void> {
    this.assertId(id);
    await this.dataSource.transaction(async (manager) => {
      const subject = await manager.findOne(Subject, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!subject) {
        throw new AppError('NOT_FOUND', 'Subject not found', 404);
      }
      await manager.update(Offering, { subjectId: id }, { subjectId: null });
      await manager.delete(Subject, id);
    });
  }

  private assertId(id: string): void {
    if (!UUID.test(id)) {
      throw new AppError('NOT_FOUND', 'Subject not found', 404);
    }
  }

  private toView(subject: Subject, offeringCount: number): AdminSubjectView {
    return {
      id: subject.id,
      name: subject.name,
      offeringCount,
      createdAt: subject.createdAt,
    };
  }

  private async offeringCounts(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows = await this.offerings
      .createQueryBuilder('o')
      .select('o.subjectId', 'subjectId')
      .addSelect('COUNT(*)', 'count')
      .where('o.subjectId IN (:...ids)', { ids })
      .groupBy('o.subjectId')
      .getRawMany<{ subjectId: string; count: string }>();
    return new Map(rows.map((row) => [row.subjectId, Number(row.count)]));
  }
}
