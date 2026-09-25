import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Offering, OfferingsActions } from './offerings.actions';

export interface OfferingsState extends EntityState<Offering> {
  status: 'idle' | 'loading' | 'error';
  errorCode: string | null;
}

export const offeringsAdapter = createEntityAdapter<Offering>({
  selectId: (o) => o.id,
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

export const initialOfferingsState: OfferingsState =
  offeringsAdapter.getInitialState({
    status: 'idle',
    errorCode: null,
  });

export const offeringsReducer = createReducer(
  initialOfferingsState,
  on(
    OfferingsActions.create,
    OfferingsActions.loadMine,
    OfferingsActions.update,
    OfferingsActions.remove,
    (state): OfferingsState => ({
      ...state,
      status: 'loading',
      errorCode: null,
    }),
  ),
  on(OfferingsActions.createSuccess, (state, { offering }) => {
    const next: OfferingsState = { ...state, status: 'idle', errorCode: null };
    return offeringsAdapter.upsertOne(offering, next);
  }),
  on(OfferingsActions.loadMineSuccess, (state, { offerings }) => {
    const next: OfferingsState = { ...state, status: 'idle', errorCode: null };
    return offeringsAdapter.setAll(offerings, next);
  }),
  on(OfferingsActions.updateSuccess, (state, { offering }) => {
    const next: OfferingsState = { ...state, status: 'idle', errorCode: null };
    return offeringsAdapter.upsertOne(offering, next);
  }),
  on(OfferingsActions.removeSuccess, (state, { id }) => {
    const next: OfferingsState = { ...state, status: 'idle', errorCode: null };
    return offeringsAdapter.removeOne(id, next);
  }),
  on(
    OfferingsActions.createFailure,
    OfferingsActions.loadMineFailure,
    OfferingsActions.updateFailure,
    OfferingsActions.removeFailure,
    (state, { errorCode }): OfferingsState => ({
      ...state,
      status: 'error',
      errorCode,
    }),
  ),
);
