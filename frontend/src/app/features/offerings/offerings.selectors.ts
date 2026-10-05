import { createSelector } from '@ngrx/store';
import { offeringsAdapter, OfferingsState } from './offerings.reducer';

export const selectOfferingsState = (state: {
  offerings: OfferingsState;
}): OfferingsState => state.offerings;

const { selectAll } = offeringsAdapter.getSelectors();

export const selectMyOfferings = createSelector(
  selectOfferingsState,
  selectAll,
);

export const selectOfferingsStatus = createSelector(
  selectOfferingsState,
  (state) => state.status,
);
