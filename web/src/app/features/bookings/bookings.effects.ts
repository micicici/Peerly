import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, mergeMap, of, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ErrorCodes, messageForErrorCode } from '../../core/error-codes';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { loadMe } from '../auth/auth.actions';
import { SlotsActions } from '../slots/slots.actions';
import { Booking, BookingsActions } from './bookings.actions';

@Injectable()
export class BookingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  book$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.book),
      exhaustMap(({ slotId, offeringId }) =>
        this.api.post<Booking>('/bookings', { slotId }).pipe(
          mergeMap((booking) => [
            BookingsActions.bookSuccess({ booking }),
            loadMe(),
            SlotsActions.loadSlotsForOffering({ offeringId }),
          ]),
          catchError((err: unknown) => {
            const failure = failureOf(err);
            const message =
              failure.errorCode === ErrorCodes.SLOT_GONE
                ? messageForErrorCode(ErrorCodes.SLOT_GONE)
                : failure.message;
            this.toast.show(message);
            if (failure.errorCode === ErrorCodes.SLOT_GONE) {
              return of(
                BookingsActions.bookFailure(failure),
                SlotsActions.loadSlotsForOffering({ offeringId }),
              );
            }
            return of(BookingsActions.bookFailure(failure));
          }),
        ),
      ),
    ),
  );

  loadMine$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.loadMine),
      exhaustMap(() =>
        this.api.get<Booking[]>('/bookings').pipe(
          map((bookings) => BookingsActions.loadMineSuccess({ bookings })),
          catchError((err: unknown) =>
            of(BookingsActions.loadMineFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  cancel$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.cancel),
      exhaustMap(({ id }) =>
        this.api.post<Booking>(`/bookings/${id}/cancel`, {}).pipe(
          mergeMap((booking) => [
            BookingsActions.cancelSuccess({ booking }),
            loadMe(),
          ]),
          catchError((err: unknown) =>
            of(BookingsActions.cancelFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  failureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          BookingsActions.loadMineFailure,
          BookingsActions.cancelFailure,
        ),
        tap(({ message }) => this.toast.show(message)),
      ),
    { dispatch: false },
  );
}
