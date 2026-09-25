import { createReducer, on } from '@ngrx/store';
import { P2P_TOKEN_KEY } from '../../core/auth.interceptor';
import {
  loadMe,
  loadMeSuccess,
  login,
  loginFailure,
  loginSuccess,
  logout,
  register,
  registerSuccess,
} from './auth.actions';

export interface MeDto {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  timezone: string;
  balance: number;
  offeringCount: number;
}

export interface AuthState {
  token: string | null;
  me: MeDto | null;
  status: 'idle' | 'loading' | 'error';
  errorCode: string | null;
}

function readStoredToken(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(P2P_TOKEN_KEY);
}

export const initialAuthState: AuthState = {
  token: readStoredToken(),
  me: null,
  status: 'idle',
  errorCode: null,
};

export const authReducer = createReducer(
  initialAuthState,
  on(login, register, loadMe, (state): AuthState => ({
    ...state,
    status: 'loading',
    errorCode: null,
  })),
  on(loginSuccess, registerSuccess, (state, { token, me }): AuthState => ({
    ...state,
    token,
    me,
    status: 'idle',
    errorCode: null,
  })),
  on(loadMeSuccess, (state, { me }): AuthState => ({
    ...state,
    me,
    status: 'idle',
    errorCode: null,
  })),
  on(loginFailure, (state, { errorCode }): AuthState => ({
    ...state,
    token: null,
    status: 'error',
    errorCode,
  })),
  on(logout, (): AuthState => ({
    token: null,
    me: null,
    status: 'idle',
    errorCode: null,
  })),
);
