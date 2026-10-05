import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { P2P_TOKEN_KEY } from '../../core/auth.interceptor';
import { ErrorCodes, messageForErrorCode } from '../../core/error-codes';
import { failureOf } from '../../core/http-error';
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
  updateMe,
  updateMeFailure,
  uploadAvatar,
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
      exhaustMap(
        ({ email, password, name, timezone, bio, gender, yearOfBirth, spokenLanguages }) =>
        this.api
          .post<{ token: string }>('/auth/register', {
            email,
            password,
            name,
            timezone,
            bio,
            gender,
            yearOfBirth,
            spokenLanguages,
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

  updateMe$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateMe),
      exhaustMap((action) => {
        const body: Record<string, unknown> = {
          name: action.name,
          bio: action.bio,
          avatarUrl: action.avatarUrl,
          timezone: action.timezone,
        };
        if (action.gender) {
          body['gender'] = action.gender;
        }
        if (action.yearOfBirth != null) {
          body['yearOfBirth'] = action.yearOfBirth;
        }
        if (action.spokenLanguages) {
          body['spokenLanguages'] = action.spokenLanguages;
        }
        return this.api
          .patch<MeDto>('/me', body)
          .pipe(
            map((me) => loadMeSuccess({ me })),
            catchError((err: unknown) => of(updateMeFailure(failureOf(err)))),
          );
      }),
    ),
  );

  uploadAvatar$ = createEffect(() =>
    this.actions$.pipe(
      ofType(uploadAvatar),
      exhaustMap(({ file }) => {
        const body = new FormData();
        body.append('file', file);
        return this.api.postForm<MeDto>('/me/avatar', body).pipe(
          map((me) => loadMeSuccess({ me })),
          catchError((err: unknown) => of(updateMeFailure(failureOf(err)))),
        );
      }),
    ),
  );

  updateMeFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(updateMeFailure),
        tap(({ message }) => this.toast.show(message)),
      ),
    { dispatch: false },
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
          const returnUrl =
            this.router.parseUrl(this.router.url).queryParams['returnUrl'];
          void this.router.navigateByUrl(returnUrl || '/home');
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
          void this.router.navigateByUrl('/home');
        }),
      ),
    { dispatch: false },
  );
}
