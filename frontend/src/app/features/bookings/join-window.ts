const JOIN_LEAD_MS = 10 * 60 * 1000;
const CLASS_DURATION_MS = 60 * 60 * 1000;
const JOIN_GRACE_MS = 10 * 60 * 1000;

export type JoinAvailability = 'hidden' | 'waiting' | 'open' | 'ended';

export function isJoinWindowOpen(
  startAt: Date,
  now: Date,
  status: 'confirmed' | 'cancelled',
): boolean {
  if (status !== 'confirmed') return false;
  const t = now.getTime();
  const start = startAt.getTime();
  const end = start + CLASS_DURATION_MS;
  return t >= start - JOIN_LEAD_MS && t <= end + JOIN_GRACE_MS;
}

export function joinAvailability(
  startAt: Date,
  now: Date,
  status: 'confirmed' | 'cancelled',
): JoinAvailability {
  if (status !== 'confirmed') return 'hidden';
  if (isJoinWindowOpen(startAt, now, status)) return 'open';
  if (now.getTime() > startAt.getTime() + CLASS_DURATION_MS + JOIN_GRACE_MS) return 'ended';
  return 'waiting';
}

export function joinCountdown(startAt: Date, now: Date): string | null {
  const remain = startAt.getTime() - JOIN_LEAD_MS - now.getTime();
  if (remain <= 0 || remain > 60 * 60 * 1000) return null;
  const total = Math.ceil(remain / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `Opens in ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
