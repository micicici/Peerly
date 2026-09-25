import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { Booking, BookingsActions } from './bookings.actions';

export interface BookingsState extends EntityState<Booking> {
  status: 'idle' | 'loading' | 'error';
  errorCode: string | null;
}

export const bookingsAdapter = createEntityAdapter<Booking>({
  selectId: (booking) => booking.id,
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});

export const initialBookingsState: BookingsState =
  bookingsAdapter.getInitialState({
    status: 'idle',
    errorCode: null,
  });

function withStart(state: BookingsState, booking: Booking): Booking {
  if (booking.startAt) {
    return booking;
  }
  const existing = state.entities[booking.id];
  return { ...booking, startAt: existing?.startAt ?? '' };
}

export const bookingsReducer = createReducer(
  initialBookingsState,
  on(
    BookingsActions.book,
    BookingsActions.loadMine,
    BookingsActions.cancel,
    (state): BookingsState => ({
      ...state,
      status: 'loading',
      errorCode: null,
    }),
  ),
  on(BookingsActions.bookSuccess, (state, { booking }) => {
    const next: BookingsState = { ...state, status: 'idle', errorCode: null };
    return bookingsAdapter.upsertOne(withStart(state, booking), next);
  }),
  on(BookingsActions.loadMineSuccess, (state, { bookings }) => {
    const next: BookingsState = { ...state, status: 'idle', errorCode: null };
    return bookingsAdapter.setAll(
      bookings.map((booking) => withStart(state, booking)),
      next,
    );
  }),
  on(BookingsActions.cancelSuccess, (state, { booking }) => {
    const next: BookingsState = { ...state, status: 'idle', errorCode: null };
    return bookingsAdapter.upsertOne(withStart(state, booking), next);
  }),
  on(
    BookingsActions.bookFailure,
    BookingsActions.loadMineFailure,
    BookingsActions.cancelFailure,
    (state, { errorCode }): BookingsState => ({
      ...state,
      status: 'error',
      errorCode,
    }),
  ),
);
