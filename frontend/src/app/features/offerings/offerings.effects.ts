import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, mergeMap, of, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { loadMe, loadMeSuccess } from '../auth/auth.actions';
import { Offering, OfferingsActions } from './offerings.actions';

@Injectable()
export class OfferingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OfferingsActions.create),
      exhaustMap(({ title, description, level, subjectName }) =>
        this.api
          .post<Offering>('/offerings', { title, description, level, subjectName })
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
      exhaustMap(({ id, title, description, level, subjectName }) =>
        this.api
          .patch<Offering>(`/offerings/${id}`, {
            title,
            description,
            level,
            subjectName,
          })
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
        tap(({ message, errorCode }) => this.toast.show(message, errorCode)),
      ),
    { dispatch: false },
  );

  clearOfferingPrompt$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OfferingsActions.createSuccess, OfferingsActions.loadMineSuccess),
        tap((action) => {
          if (
            action.type === OfferingsActions.loadMineSuccess.type &&
            action.offerings.length === 0
          ) {
            return;
          }
          this.toast.clearResolved('OFFERING_REQUIRED');
        }),
      ),
    { dispatch: false },
  );

  clearOfferingPromptOnMe$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(loadMeSuccess),
        tap(({ me }) => {
          if (me.offeringCount >= 1) {
            this.toast.clearResolved('OFFERING_REQUIRED');
          }
        }),
      ),
    { dispatch: false },
  );
}
