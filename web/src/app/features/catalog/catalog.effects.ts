import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { CatalogActions, CatalogOffering } from './catalog.actions';

@Injectable()
export class CatalogEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  browse$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CatalogActions.browse),
      switchMap(({ q, level }) => {
        const params = new URLSearchParams();
        const query = q.trim();
        if (query) {
          params.set('q', query);
        }
        if (level) {
          params.set('level', level);
        }
        const qs = params.toString();
        const path = qs ? `/offerings?${qs}` : '/offerings';
        return this.api.get<CatalogOffering[]>(path).pipe(
          map((offerings) => CatalogActions.browseSuccess({ offerings })),
          catchError((err: unknown) =>
            of(CatalogActions.browseFailure(failureOf(err))),
          ),
        );
      }),
    ),
  );

  loadDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CatalogActions.loadDetail),
      switchMap(({ id }) =>
        this.api.get<CatalogOffering>(`/offerings/${id}`).pipe(
          map((offering) => CatalogActions.loadDetailSuccess({ offering })),
          catchError((err: unknown) =>
            of(CatalogActions.loadDetailFailure(failureOf(err))),
          ),
        ),
      ),
    ),
  );

  failureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(CatalogActions.browseFailure, CatalogActions.loadDetailFailure),
        tap(({ message }) => this.toast.show(message)),
      ),
    { dispatch: false },
  );
}
