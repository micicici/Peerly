import { createSelector } from '@ngrx/store';
import { selectMe } from '../auth/auth.selectors';
import { ledgerAdapter, LedgerState } from './ledger.reducer';

export const selectLedgerState = (state: { ledger: LedgerState }): LedgerState =>
  state.ledger;

const { selectAll } = ledgerAdapter.getSelectors();

export const selectLedgerEntries = createSelector(
  selectLedgerState,
  selectAll,
);

export const selectBalance = createSelector(selectMe, (me) => me?.balance ?? 0);
