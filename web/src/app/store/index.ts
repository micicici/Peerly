import { ActionReducerMap } from '@ngrx/store';
import { authReducer, AuthState } from '../features/auth/auth.reducer';
import { catalogReducer, CatalogState } from '../features/catalog/catalog.reducer';
import {
  offeringsReducer,
  OfferingsState,
} from '../features/offerings/offerings.reducer';

export interface AppState {
  auth: AuthState;
  offerings: OfferingsState;
  catalog: CatalogState;
}

export const reducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  offerings: offeringsReducer,
  catalog: catalogReducer,
};
