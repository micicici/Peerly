import { isJoinWindowOpen } from './join-window';

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
  it('true at start+60m', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T13:00:00.000Z'), 'confirmed')).toBe(true);
  });
  it('false after start+60m', () => {
    expect(isJoinWindowOpen(start, new Date('2026-09-25T13:00:01.000Z'), 'confirmed')).toBe(false);
  });
});
