/// <reference types="jest" />
import { Offering } from '../offerings/offering.entity';
import { Subject } from '../offerings/subject.entity';
import { SubjectModerationService } from './subject-moderation.service';

const createdAt = new Date('2026-09-01T00:00:00.000Z');

function managerFor(subjects: Record<string, { id: string; name: string; nameKey: string }>) {
  return {
    findOne: jest.fn(async (entity: unknown, opts: { where: { id?: string; nameKey?: string } }) => {
      if (entity !== Subject) {
        return null;
      }
      if (opts.where.id) {
        return subjects[opts.where.id] ? { ...subjects[opts.where.id], createdAt } : null;
      }
      const match = Object.values(subjects).find(
        (subject) => subject.nameKey === opts.where.nameKey,
      );
      return match ? { ...match, createdAt } : null;
    }),
    save: jest.fn(async (subject: { id: string; name: string; nameKey: string }) => {
      subjects[subject.id] = subject;
      return subject;
    }),
    update: jest.fn(),
    delete: jest.fn(async (_entity: unknown, id: string) => {
      delete subjects[id];
    }),
    count: jest.fn(async () => 2),
  };
}

describe('SubjectModerationService', () => {
  const sourceId = '11111111-1111-4111-8111-111111111111';
  const targetId = '22222222-2222-4222-8222-222222222222';

  it('moves offerings onto the target subject and deletes the source', async () => {
    const subjects = {
      [sourceId]: { id: sourceId, name: 'Maths', nameKey: 'maths' },
      [targetId]: { id: targetId, name: 'Math', nameKey: 'math' },
    };
    const manager = managerFor(subjects);
    const service = new SubjectModerationService(
      {} as never,
      {} as never,
      { transaction: async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager) } as never,
    );

    const result = await service.merge(sourceId, targetId);

    expect(manager.update).toHaveBeenCalledWith(
      Offering,
      { subjectId: sourceId },
      { subjectId: targetId },
    );
    expect(manager.delete).toHaveBeenCalledWith(Subject, sourceId);
    expect(subjects[sourceId]).toBeUndefined();
    expect(result).toMatchObject({ id: targetId, name: 'Math', offeringCount: 2 });
  });

  it('clears subject links before deleting a subject', async () => {
    const subjects = {
      [sourceId]: { id: sourceId, name: 'Typo', nameKey: 'typo' },
    };
    const manager = managerFor(subjects);
    const service = new SubjectModerationService(
      {} as never,
      {} as never,
      { transaction: async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager) } as never,
    );

    await service.remove(sourceId);

    expect(manager.update).toHaveBeenCalledWith(
      Offering,
      { subjectId: sourceId },
      { subjectId: null },
    );
    expect(subjects[sourceId]).toBeUndefined();
  });

  it('renames a subject and refuses a name that already exists', async () => {
    const subjects = {
      [sourceId]: { id: sourceId, name: 'Gitar', nameKey: 'gitar' },
      [targetId]: { id: targetId, name: 'Guitar', nameKey: 'guitar' },
    };
    const manager = managerFor(subjects);
    const service = new SubjectModerationService(
      {} as never,
      {} as never,
      { transaction: async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager) } as never,
    );

    await expect(service.rename(sourceId, 'Guitar')).rejects.toMatchObject({
      code: 'SUBJECT_EXISTS',
      httpStatus: 409,
    });

    const renamed = await service.rename(sourceId, '  Guitar  basics ');
    expect(renamed.name).toBe('Guitar basics');
    expect(subjects[sourceId].nameKey).toBe('guitar basics');
  });
});
