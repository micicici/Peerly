import { createActionGroup, emptyProps, props } from '@ngrx/store';

export interface Booking {
  id: string;
  slotId: string;
  learnerId: string;
  teacherId: string;
  offeringId: string;
  joinUrl: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
  startAt: string;
  offeringTitle: string;
  subjectName: string | null;
  teacherName: string;
  learnerName: string;
  materials: { id: string; originalName: string }[];
}

export const BookingsActions = createActionGroup({
  source: 'Bookings',
  events: {
    Book: props<{ slotId: string; offeringId: string }>(),
    'Book Success': props<{ booking: Booking }>(),
    'Book Failure': props<{
      errorCode: string;
      message: string;
      slotId?: string;
    }>(),
    'Load Mine': emptyProps(),
    'Load Mine Success': props<{ bookings: Booking[] }>(),
    'Load Mine Failure': props<{ errorCode: string; message: string }>(),
    Cancel: props<{ id: string }>(),
    'Cancel Success': props<{ booking: Booking }>(),
    'Cancel Failure': props<{ errorCode: string; message: string }>(),
  },
});
