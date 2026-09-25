import { createSelector } from '@ngrx/store';
import { catalogAdapter, CatalogState } from './catalog.reducer';

export const selectCatalogState = (state: {
  catalog: CatalogState;
}): CatalogState => state.catalog;

const { selectAll } = catalogAdapter.getSelectors();

export const selectCatalogOfferings = createSelector(
  selectCatalogState,
  selectAll,
);

export const selectCatalogStatus = createSelector(
  selectCatalogState,
  (state) => state.status,
);

export const selectSelectedOffering = createSelector(
  selectCatalogState,
  (state) =>
    state.selectedId ? (state.entities[state.selectedId] ?? null) : null,
);
