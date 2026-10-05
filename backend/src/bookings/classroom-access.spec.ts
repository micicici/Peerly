import { isClassroomJoinOpen } from './classroom-access';

describe('isClassroomJoinOpen', () => {
  const start = new Date('2026-09-25T12:00:00.000Z');
  const end = new Date('2026-09-25T13:00:00.000Z');

  it('is closed 1ms before the 10-minute mark', () => {
    expect(
      isClassroomJoinOpen(
        start,
        end,
        new Date('2026-09-25T11:49:59.999Z'),
        'confirmed',
      ),
    ).toBe(false);
  });

  it('opens exactly 10 minutes before start', () => {
    expect(
      isClassroomJoinOpen(start, end, new Date('2026-09-25T11:50:00.000Z'), 'confirmed'),
    ).toBe(true);
  });

  it('stays open through the scheduled end', () => {
    expect(
      isClassroomJoinOpen(start, end, new Date('2026-09-25T13:00:00.000Z'), 'confirmed'),
    ).toBe(true);
  });

  it('stays open for 10 minutes after the scheduled end', () => {
    expect(
      isClassroomJoinOpen(start, end, new Date('2026-09-25T13:10:00.000Z'), 'confirmed'),
    ).toBe(true);
  });

  it('closes after the 10 minute grace', () => {
    expect(
      isClassroomJoinOpen(start, end, new Date('2026-09-25T13:10:00.001Z'), 'confirmed'),
    ).toBe(false);
  });

  it('stays closed when the booking is cancelled', () => {
    expect(
      isClassroomJoinOpen(start, end, new Date('2026-09-25T12:00:00.000Z'), 'cancelled'),
    ).toBe(false);
  });
});
