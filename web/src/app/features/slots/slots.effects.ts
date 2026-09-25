import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { Slot, SlotsActions } from './slots.actions';

@Injectable()
export class SlotsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  loadForOffering$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SlotsActions.loadSlotsForOffering),
      switchMap(({ offeringId }) =>
        this.api.get<Slot[]>(`/slots?offeringId=${offeringId}`).pipe(
          map((slots) =>
            SlotsActions.loadSlotsForOfferingSuccess({ offeringId, slots }),
          ),
          catchError((err: unknown) =>
            of(SlotsActions.loadSlotsForOfferingFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  loadMine$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SlotsActions.loadMine),
      exhaustMap(() =>
        this.api.get<Slot[]>('/slots/mine').pipe(
          map((slots) => SlotsActions.loadMineSuccess({ slots })),
          catchError((err: unknown) =>
            of(SlotsActions.loadMineFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SlotsActions.create),
      exhaustMap(({ offeringId, startAt }) =>
        this.api.post<Slot>('/slots', { offeringId, startAt }).pipe(
          map((slot) => SlotsActions.createSuccess({ slot })),
          catchError((err: unknown) =>
            of(SlotsActions.createFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  remove$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SlotsActions.remove),
      exhaustMap(({ id }) =>
        this.api.delete(`/slots/${id}`).pipe(
          map(() => SlotsActions.removeSuccess({ id })),
          catchError((err: unknown) =>
            of(SlotsActions.removeFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  failureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          SlotsActions.loadSlotsForOfferingFailure,
          SlotsActions.loadMineFailure,
          SlotsActions.createFailure,
          SlotsActions.removeFailure,
        ),
        tap(({ message }) => this.toast.show(message)),
      ),
    { dispatch: false },
  );
}
