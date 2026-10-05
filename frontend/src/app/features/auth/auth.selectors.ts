import { createSelector } from '@ngrx/store';
import { AuthState } from './auth.reducer';

export const selectAuthState = (state: { auth: AuthState }): AuthState =>
  state.auth;

export const selectMe = createSelector(
  selectAuthState,
  (auth) => auth.me,
);

export const selectToken = createSelector(
  selectAuthState,
  (auth) => auth.token,
);

export const selectIsAuthed = createSelector(
  selectToken,
  (token) => token !== null && token.length > 0,
);

export const selectNeedsOffering = createSelector(
  selectMe,
  (me) => me !== null && me.role !== 'ADMIN' && me.offeringCount < 1,
);

export const selectIsAdmin = createSelector(
  selectMe,
  (me) => me?.role === 'ADMIN',
);
