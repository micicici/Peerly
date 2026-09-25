import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { P2P_TOKEN_KEY } from '../../core/auth.interceptor';
import { ErrorCodes, messageForErrorCode } from '../../core/error-codes';
import { ToastService } from '../../core/toast.service';
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
import type { MeDto } from './auth.reducer';

function codeOf(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { code?: unknown } | null;
    if (body && typeof body.code === 'string' && body.code.length > 0) {
      return body.code;
    }
  }
  return ErrorCodes.INTERNAL;
}

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(login),
      exhaustMap(({ email, password }) =>
        this.api.post<{ token: string }>('/auth/login', { email, password }).pipe(
          tap(({ token }) => localStorage.setItem(P2P_TOKEN_KEY, token)),
          exhaustMap(({ token }) =>
            this.api.get<MeDto>('/me').pipe(
              map((me) => loginSuccess({ token, me })),
              catchError((err: unknown) => {
                localStorage.removeItem(P2P_TOKEN_KEY);
                return of(loginFailure({ errorCode: codeOf(err) }));
              }),
            ),
          ),
          catchError((err: unknown) =>
            of(loginFailure({ errorCode: codeOf(err) })),
          ),
        ),
      ),
    ),
  );

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(register),
      exhaustMap(({ email, password, name, timezone }) =>
        this.api
          .post<{ token: string }>('/auth/register', {
            email,
            password,
            name,
            timezone,
          })
          .pipe(
            tap(({ token }) => localStorage.setItem(P2P_TOKEN_KEY, token)),
            exhaustMap(({ token }) =>
              this.api.get<MeDto>('/me').pipe(
                map((me) => registerSuccess({ token, me })),
                catchError((err: unknown) => {
                  localStorage.removeItem(P2P_TOKEN_KEY);
                  return of(loginFailure({ errorCode: codeOf(err) }));
                }),
              ),
            ),
            catchError((err: unknown) =>
              of(loginFailure({ errorCode: codeOf(err) })),
            ),
          ),
      ),
    ),
  );

  loadMe$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadMe),
      exhaustMap(() =>
        this.api.get<MeDto>('/me').pipe(
          map((me) => loadMeSuccess({ me })),
          catchError((err: unknown) => {
            localStorage.removeItem(P2P_TOKEN_KEY);
            return of(loginFailure({ errorCode: codeOf(err) }));
          }),
        ),
      ),
    ),
  );

  loginFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(loginFailure),
        tap(({ errorCode }) => {
          localStorage.removeItem(P2P_TOKEN_KEY);
          this.toast.show(messageForErrorCode(errorCode));
        }),
      ),
    { dispatch: false },
  );

  redirectAfterAuth$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(loginSuccess, registerSuccess),
        tap(() => {
          void this.router.navigateByUrl('/home');
        }),
      ),
    { dispatch: false },
  );

  logout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(logout),
        tap(() => {
          localStorage.removeItem(P2P_TOKEN_KEY);
          this.toast.clear();
          void this.router.navigateByUrl('/login');
        }),
      ),
    { dispatch: false },
  );
}
