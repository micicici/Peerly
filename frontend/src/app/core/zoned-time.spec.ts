import { localDateHourToUtcIso } from './zoned-time';

function onUtcHour(iso: string): boolean {
  const date = new Date(iso);
  return (
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

describe('localDateHourToUtcIso', () => {
  it('posts Asia/Kolkata 09:00 as 03:30 UTC', () => {
    const iso = localDateHourToUtcIso('2026-09-25', 9, 'Asia/Kolkata');
    expect(iso).toBe('2026-09-25T03:30:00.000Z');
    expect(onUtcHour(iso)).toBe(false);
    const labeledHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(iso));
    expect(labeledHour).toBe('09');
  });

  it('keeps a whole-hour offset on the UTC hour', () => {
    const iso = localDateHourToUtcIso('2026-09-25', 9, 'America/New_York');
    expect(iso).toBe('2026-09-25T13:00:00.000Z');
    expect(onUtcHour(iso)).toBe(true);
  });
});
