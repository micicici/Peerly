import { isJoinWindowOpen, joinAvailability, joinCountdown } from './join-window';

describe('isJoinWindowOpen', () => {
  const start = new Date('2026-09-25T12:00:00.000Z');
  it('false if cancelled', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T12:00:00.000Z'), 'cancelled')).toBe(false);
  });
  it('true 10 minutes before', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T11:50:00.000Z'), 'confirmed')).toBe(true);
  });
  it('false 11 minutes before', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T11:49:00.000Z'), 'confirmed')).toBe(false);
  });
  it('true at the scheduled end', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T13:00:00.000Z'), 'confirmed')).toBe(true);
  });
  it('true 10 minutes after the scheduled end', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T13:10:00.000Z'), 'confirmed')).toBe(true);
  });
  it('false after the 10 minute grace', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T13:10:01.000Z'), 'confirmed')).toBe(false);
  });

  it('counts down until the window opens', () => {
    expect(joinAvailability(start, new Date('2026-09-25T11:40:00.000Z'), 'confirmed')).toBe('waiting');
    expect(joinCountdown(start, new Date('2026-09-25T11:40:00.000Z'))).toBe('Opens in 10m 00s');
    expect(joinCountdown(start, new Date('2026-09-25T10:00:00.000Z'))).toBeNull();
    expect(joinAvailability(start, new Date('2026-09-25T13:05:00.000Z'), 'confirmed')).toBe('open');
    expect(joinAvailability(start, new Date('2026-09-25T13:30:00.000Z'), 'confirmed')).toBe('ended');
  });
});
