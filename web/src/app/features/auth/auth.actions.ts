import { createAction, props } from '@ngrx/store';
import type { MeDto } from './auth.reducer';

export const login = createAction(
  '[Auth] Login',
  props<{ email: string; password: string }>(),
);

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ token: string; me: MeDto }>(),
);

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ errorCode: string }>(),
);

export const register = createAction(
  '[Auth] Register',
  props<{
    email: string;
    password: string;
    name: string;
    timezone: string;
  }>(),
);

export const registerSuccess = createAction(
  '[Auth] Register Success',
  props<{ token: string; me: MeDto }>(),
);

export const loadMe = createAction('[Auth] Load Me');

export const loadMeSuccess = createAction(
  '[Auth] Load Me Success',
  props<{ me: MeDto }>(),
);

export const logout = createAction('[Auth] Logout');
