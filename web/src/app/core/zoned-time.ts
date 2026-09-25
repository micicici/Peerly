function safeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour'),
    pick('minute'),
    pick('second'),
  );
  return asUtc - instant.getTime();
}

export function formatInTimezone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    timeZone: safeZone(timeZone || 'UTC'),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function localDateHourToUtcIso(
  date: string,
  hour: number,
  timeZone: string,
): string {
  const [year, month, day] = date.split('-').map(Number);
  const zone = safeZone(timeZone || 'UTC');
  let utcMs = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    utcMs =
      Date.UTC(year, month - 1, day, hour, 0, 0, 0) -
      zoneOffsetMs(new Date(utcMs), zone);
  }
  return new Date(utcMs).toISOString();
}

export function isUtcOnTheHour(iso: string): boolean {
  const date = new Date(iso);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}
