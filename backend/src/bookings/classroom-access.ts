import { BookingStatus } from './booking.entity';

export const JOIN_LEAD_MS = 10 * 60 * 1000;
export const JOIN_GRACE_MS = 10 * 60 * 1000;

export function isClassroomJoinOpen(
  startAt: Date,
  endAt: Date,
  now: Date,
  status: BookingStatus,
): boolean {
  if (status !== 'confirmed') {
    return false;
  }
  const t = now.getTime();
  return t >= startAt.getTime() - JOIN_LEAD_MS && t <= endAt.getTime() + JOIN_GRACE_MS;
}
