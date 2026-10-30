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
  props<{ errorCode: string; message: string }>(),
);

export const clearAuthError = createAction('[Auth] Clear Error');

export const register = createAction(
  '[Auth] Register',
  props<{
    email: string;
    password: string;
    name: string;
    timezone: string;
    bio: string;
    gender: 'male' | 'female';
    yearOfBirth: number;
    spokenLanguages: string[];
  }>(),
);

export const registerSuccess = createAction(
  '[Auth] Register Success',
  props<{ token: string; me: MeDto }>(),
);

export const uploadAvatar = createAction(
  '[Auth] Upload Avatar',
  props<{ file: File }>(),
);

export const loadMe = createAction('[Auth] Load Me');

export const updateMe = createAction(
  '[Auth] Update Me',
  props<{
    name: string;
    bio: string;
    avatarUrl: string;
    timezone: string;
    gender?: 'male' | 'female';
    yearOfBirth?: number;
    spokenLanguages?: string[];
  }>(),
);

export const updateMeFailure = createAction(
  '[Auth] Update Me Failure',
  props<{ errorCode: string; message: string }>(),
);

export const loadMeSuccess = createAction(
  '[Auth] Load Me Success',
  props<{ me: MeDto }>(),
);

export const logout = createAction('[Auth] Logout');
