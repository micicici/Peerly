import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Slot, SlotsActions } from './slots.actions';

export interface SlotsState extends EntityState<Slot> {
  status: 'idle' | 'loading' | 'error';
  errorCode: string | null;
}

export const slotsAdapter = createEntityAdapter<Slot>({
  selectId: (slot) => slot.id,
  sortComparer: (a, b) => a.startAt.localeCompare(b.startAt),
});

export const initialSlotsState: SlotsState = slotsAdapter.getInitialState({
  status: 'idle',
  errorCode: null,
});

export const slotsReducer = createReducer(
  initialSlotsState,
  on(
    SlotsActions.loadSlotsForOffering,
    SlotsActions.loadMine,
    SlotsActions.create,
    SlotsActions.remove,
    (state): SlotsState => ({
      ...state,
      status: 'loading',
      errorCode: null,
    }),
  ),
  on(
    SlotsActions.loadSlotsForOfferingSuccess,
    (state, { offeringId, slots }) => {
      const incoming = new Set(slots.map((slot) => slot.id));
      const stale = (state.ids as string[]).filter((id) => {
        const slot = state.entities[id];
        return (
          slot?.offeringId === offeringId &&
          slot.status === 'open' &&
          !incoming.has(id)
        );
      });
      const cleared = slotsAdapter.removeMany(stale, state);
      const next: SlotsState = { ...cleared, status: 'idle', errorCode: null };
      return slotsAdapter.upsertMany(slots, next);
    },
  ),
  on(SlotsActions.loadMineSuccess, (state, { slots }) => {
    const next: SlotsState = { ...state, status: 'idle', errorCode: null };
    return slotsAdapter.upsertMany(slots, next);
  }),
  on(SlotsActions.createSuccess, (state, { slot }) => {
    const next: SlotsState = { ...state, status: 'idle', errorCode: null };
    return slotsAdapter.upsertOne(slot, next);
  }),
  on(SlotsActions.removeSuccess, (state, { id }) => {
    const next: SlotsState = { ...state, status: 'idle', errorCode: null };
    return slotsAdapter.removeOne(id, next);
  }),
  on(
    SlotsActions.loadSlotsForOfferingFailure,
    SlotsActions.loadMineFailure,
    SlotsActions.createFailure,
    SlotsActions.removeFailure,
    (state, { errorCode }): SlotsState => ({
      ...state,
      status: 'error',
      errorCode,
    }),
  ),
);
