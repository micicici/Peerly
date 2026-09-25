import { createActionGroup, emptyProps, props } from '@ngrx/store';

export type LedgerType = 'starter' | 'spend' | 'earn' | 'refund' | 'reversal';

export interface LedgerEntry {
  id: string;
  userId: string;
  amount: number;
  type: LedgerType;
  bookingId: string | null;
  createdAt: string;
}

export const LedgerActions = createActionGroup({
  source: 'Ledger',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ entries: LedgerEntry[] }>(),
    'Load Failure': props<{ errorCode: string; message: string }>(),
  },
});
