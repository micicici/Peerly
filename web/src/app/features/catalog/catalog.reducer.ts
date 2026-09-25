import { createEntityAdapter, EntityState } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { CatalogActions, CatalogOffering } from './catalog.actions';

export interface CatalogState extends EntityState<CatalogOffering> {
  selectedId: string | null;
  status: 'idle' | 'loading' | 'error';
  errorCode: string | null;
}

export const catalogAdapter = createEntityAdapter<CatalogOffering>({
  selectId: (o) => o.id,
  sortComparer: false,
});

export const initialCatalogState: CatalogState = catalogAdapter.getInitialState({
  selectedId: null,
  status: 'idle',
  errorCode: null,
});

export const catalogReducer = createReducer(
  initialCatalogState,
  on(CatalogActions.browse, (state): CatalogState => ({
    ...state,
    status: 'loading',
    errorCode: null,
  })),
  on(CatalogActions.browseSuccess, (state, { offerings }) => {
    const next: CatalogState = { ...state, status: 'idle', errorCode: null };
    return catalogAdapter.setAll(offerings, next);
  }),
  on(CatalogActions.loadDetail, (state, { id }): CatalogState => ({
    ...state,
    selectedId: id,
    status: 'loading',
    errorCode: null,
  })),
  on(CatalogActions.loadDetailSuccess, (state, { offering }) => {
    const next: CatalogState = {
      ...state,
      selectedId: offering.id,
      status: 'idle',
      errorCode: null,
    };
    return catalogAdapter.upsertOne(offering, next);
  }),
  on(
    CatalogActions.browseFailure,
    CatalogActions.loadDetailFailure,
    (state, { errorCode }): CatalogState => ({
      ...state,
      status: 'error',
      errorCode,
    }),
  ),
);
