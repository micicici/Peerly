import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, mergeMap, of, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { loadMe } from '../auth/auth.actions';
import { Offering, OfferingsActions } from './offerings.actions';

@Injectable()
export class OfferingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OfferingsActions.create),
      exhaustMap(({ title, description, level }) =>
        this.api
          .post<Offering>('/offerings', { title, description, level })
          .pipe(
            mergeMap((offering) => [
              OfferingsActions.createSuccess({ offering }),
              loadMe(),
            ]),
            catchError((err: unknown) =>
              of(OfferingsActions.createFailure(failureOf(err))),
            ),
          ),
      ),
    ),
  );

  loadMine$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OfferingsActions.loadMine),
      exhaustMap(() =>
        this.api.get<Offering[]>('/offerings/mine').pipe(
          map((offerings) => OfferingsActions.loadMineSuccess({ offerings })),
          catchError((err: unknown) =>
            of(OfferingsActions.loadMineFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OfferingsActions.update),
      exhaustMap(({ id, title, description, level }) =>
        this.api
          .patch<Offering>(`/offerings/${id}`, { title, description, level })
          .pipe(
            map((offering) => OfferingsActions.updateSuccess({ offering })),
            catchError((err: unknown) =>
              of(OfferingsActions.updateFailure(failureOf(err))),
            ),
          ),
      ),
    ),
  );

  remove$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OfferingsActions.remove),
      exhaustMap(({ id }) =>
        this.api.delete(`/offerings/${id}`).pipe(
          mergeMap(() => [OfferingsActions.removeSuccess({ id }), loadMe()]),
          catchError((err: unknown) =>
            of(OfferingsActions.removeFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  failureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          OfferingsActions.createFailure,
          OfferingsActions.loadMineFailure,
          OfferingsActions.updateFailure,
          OfferingsActions.removeFailure,
        ),
        tap(({ message }) => this.toast.show(message)),
      ),
    { dispatch: false },
  );
}
