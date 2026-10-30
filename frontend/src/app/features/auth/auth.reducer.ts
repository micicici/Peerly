import { createReducer, on } from '@ngrx/store';
import { P2P_TOKEN_KEY } from '../../core/auth.interceptor';
import {
  clearAuthError,
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
  gender: 'male' | 'female' | null;
  yearOfBirth: number | null;
  spokenLanguages: string[];
  timezone: string;
  role: 'USER' | 'ADMIN';
  balance: number;
  offeringCount: number;
}

export interface AuthState {
  token: string | null;
  me: MeDto | null;
  status: 'idle' | 'loading' | 'error';
  errorCode: string | null;
  errorMessage: string | null;
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
  errorMessage: null,
};

export const authReducer = createReducer(
  initialAuthState,
  on(login, register, loadMe, (state): AuthState => ({
    ...state,
    status: 'loading',
    errorCode: null,
    errorMessage: null,
  })),
  on(loginSuccess, registerSuccess, (state, { token, me }): AuthState => ({
    ...state,
    token,
    me,
    status: 'idle',
    errorCode: null,
    errorMessage: null,
  })),
  on(loadMeSuccess, (state, { me }): AuthState => ({
    ...state,
    me,
    status: 'idle',
    errorCode: null,
    errorMessage: null,
  })),
  on(loginFailure, (state, { errorCode, message }): AuthState => ({
    ...state,
    token: null,
    status: 'error',
    errorCode,
    errorMessage: message,
  })),
  on(clearAuthError, (state): AuthState => ({
    ...state,
    status: state.status === 'error' ? 'idle' : state.status,
    errorCode: null,
    errorMessage: null,
  })),
  on(logout, (): AuthState => ({
    token: null,
    me: null,
    status: 'idle',
    errorCode: null,
    errorMessage: null,
  })),
);
