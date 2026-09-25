export function isJoinWindowOpen(
  startAt: Date,
  now: Date,
  status: 'confirmed' | 'cancelled',
): boolean {
  if (status !== 'confirmed') return false;
  const t = now.getTime();
  const start = startAt.getTime();
  return t >= start - 10 * 60 * 1000 && t <= start + 60 * 60 * 1000;
}
