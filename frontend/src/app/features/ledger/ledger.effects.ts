import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { LedgerActions, LedgerEntry } from './ledger.actions';

@Injectable()
export class LedgerEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(LedgerActions.load),
      exhaustMap(() =>
        this.api.get<LedgerEntry[]>('/ledger').pipe(
          map((entries) => LedgerActions.loadSuccess({ entries })),
          catchError((err: unknown) =>
            of(LedgerActions.loadFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  failureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(LedgerActions.loadFailure),
        tap(({ message }) => this.toast.show(message)),
      ),
    { dispatch: false },
  );
}
