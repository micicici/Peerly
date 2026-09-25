import { createActionGroup, emptyProps, props } from '@ngrx/store';

export type SlotStatus = 'open' | 'booked' | 'cancelled';

export interface Slot {
  id: string;
  offeringId: string;
  teacherId: string;
  startAt: string;
  endAt: string;
  status: SlotStatus;
}

export const SlotsActions = createActionGroup({
  source: 'Slots',
  events: {
    'Load Slots For Offering': props<{ offeringId: string }>(),
    'Load Slots For Offering Success': props<{
      offeringId: string;
      slots: Slot[];
    }>(),
    'Load Slots For Offering Failure': props<{
      errorCode: string;
      message: string;
    }>(),
    'Load Mine': emptyProps(),
    'Load Mine Success': props<{ slots: Slot[] }>(),
    'Load Mine Failure': props<{ errorCode: string; message: string }>(),
    Create: props<{ offeringId: string; startAt: string }>(),
    'Create Success': props<{ slot: Slot }>(),
    'Create Failure': props<{ errorCode: string; message: string }>(),
    Remove: props<{ id: string }>(),
    'Remove Success': props<{ id: string }>(),
    'Remove Failure': props<{ errorCode: string; message: string }>(),
  },
});
