import { createSelector } from '@ngrx/store';
import { slotsAdapter, SlotsState } from './slots.reducer';

export const selectSlotsState = (state: { slots: SlotsState }): SlotsState =>
  state.slots;

const { selectAll } = slotsAdapter.getSelectors();

export const selectAllSlots = createSelector(selectSlotsState, selectAll);

export const selectMySlots = selectAllSlots;

export const selectSlotsStatus = createSelector(
  selectSlotsState,
  (state) => state.status,
);
