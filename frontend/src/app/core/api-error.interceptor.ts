import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { failureOf } from './http-error';

/** Rewrites 400 and 409 bodies so callers see the backend validation text. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (
        !(err instanceof HttpErrorResponse) ||
        (err.status !== 400 && err.status !== 409)
      ) {
        return throwError(() => err);
      }
      const failure = failureOf(err);
      return throwError(
        () =>
          new HttpErrorResponse({
            error: { code: failure.errorCode, message: failure.message },
            headers: err.headers,
            status: err.status,
            statusText: err.statusText,
            url: err.url ?? undefined,
          }),
      );
    }),
  );
