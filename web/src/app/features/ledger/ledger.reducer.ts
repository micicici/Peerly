import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { LedgerActions, LedgerEntry } from './ledger.actions';

export interface LedgerState extends EntityState<LedgerEntry> {
  status: 'idle' | 'loading' | 'error';
  errorCode: string | null;
}

export const ledgerAdapter = createEntityAdapter<LedgerEntry>({
  selectId: (entry) => entry.id,
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

export const initialLedgerState: LedgerState = ledgerAdapter.getInitialState({
  status: 'idle',
  errorCode: null,
});

export const ledgerReducer = createReducer(
  initialLedgerState,
  on(
    LedgerActions.load,
    (state): LedgerState => ({
      ...state,
      status: 'loading',
      errorCode: null,
    }),
  ),
  on(LedgerActions.loadSuccess, (state, { entries }) => {
    const next: LedgerState = { ...state, status: 'idle', errorCode: null };
    return ledgerAdapter.setAll(entries, next);
  }),
  on(
    LedgerActions.loadFailure,
    (state, { errorCode }): LedgerState => ({
      ...state,
      status: 'error',
      errorCode,
    }),
  ),
);
