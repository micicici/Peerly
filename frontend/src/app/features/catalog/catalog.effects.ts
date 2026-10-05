import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, filter, map, of, switchMap, tap, withLatestFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';
import { OfferingsActions } from '../offerings/offerings.actions';
import { CatalogActions, CatalogOffering } from './catalog.actions';
import { selectCatalogQuery } from './catalog.selectors';

@Injectable()
export class CatalogEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(Store);

  browse$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CatalogActions.browse),
      switchMap(({ q, level, languages, subjectIds }) => {
        const params = new URLSearchParams();
        const query = q.trim();
        if (query) {
          params.set('q', query);
        }
        if (level) {
          params.set('level', level);
        }
        if (languages.length > 0) {
          params.set('languages', languages.join(','));
        }
        if (subjectIds.length > 0) {
          params.set('subjects', subjectIds.join(','));
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

  refreshFilters$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OfferingsActions.updateSuccess, OfferingsActions.removeSuccess),
      withLatestFrom(this.store.select(selectCatalogQuery)),
      filter((pair): pair is [typeof pair[0], NonNullable<(typeof pair)[1]>] => pair[1] !== null),
      map(([, query]) => CatalogActions.browse(query)),
    ),
  );

  failureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(CatalogActions.browseFailure, CatalogActions.loadDetailFailure),
        tap(({ message, errorCode }) => this.toast.show(message, errorCode)),
      ),
    { dispatch: false },
  );
}
