import { ActionReducerMap } from '@ngrx/store';
import { authReducer, AuthState } from '../features/auth/auth.reducer';
import {
  bookingsReducer,
  BookingsState,
} from '../features/bookings/bookings.reducer';
import { catalogReducer, CatalogState } from '../features/catalog/catalog.reducer';
import { ledgerReducer, LedgerState } from '../features/ledger/ledger.reducer';
import {
  offeringsReducer,
  OfferingsState,
} from '../features/offerings/offerings.reducer';
import { slotsReducer, SlotsState } from '../features/slots/slots.reducer';

export interface AppState {
  auth: AuthState;
  offerings: OfferingsState;
  catalog: CatalogState;
  slots: SlotsState;
  bookings: BookingsState;
  ledger: LedgerState;
}

export const reducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  offerings: offeringsReducer,
  catalog: catalogReducer,
  slots: slotsReducer,
  bookings: bookingsReducer,
  ledger: ledgerReducer,
};
