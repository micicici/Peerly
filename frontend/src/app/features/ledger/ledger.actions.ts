import { createActionGroup, emptyProps, props } from '@ngrx/store';

export type LedgerType = 'starter' | 'spend' | 'earn' | 'refund' | 'reversal';

export interface LedgerEntry {
  id: string;
  userId: string;
  amount: number;
  type: LedgerType;
  bookingId: string | null;
  createdAt: string;
  subjectName: string | null;
  classTitle: string | null;
  counterpartName: string | null;
  counterpartRole: 'teacher' | 'student' | null;
  bookingStatus: 'confirmed' | 'cancelled' | null;
  materials: { id: string; originalName: string }[];
}

export const LedgerActions = createActionGroup({
  source: 'Ledger',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ entries: LedgerEntry[] }>(),
    'Load Failure': props<{ errorCode: string; message: string }>(),
  },
});
