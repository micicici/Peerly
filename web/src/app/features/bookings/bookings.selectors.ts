import { createSelector } from '@ngrx/store';
import { bookingsAdapter, BookingsState } from './bookings.reducer';

export const selectBookingsState = (state: {
  bookings: BookingsState;
}): BookingsState => state.bookings;

const { selectAll } = bookingsAdapter.getSelectors();

export const selectMyBookings = createSelector(selectBookingsState, selectAll);

export const selectBookingsStatus = createSelector(
  selectBookingsState,
  (state) => state.status,
);
