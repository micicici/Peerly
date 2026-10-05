import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { ReplaySubject } from 'rxjs';
import { OfferingsActions } from '../offerings/offerings.actions';
import { CatalogActions } from './catalog.actions';
import { CatalogEffects } from './catalog.effects';
import { initialCatalogState } from './catalog.reducer';

describe('CatalogEffects refreshFilters$', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('re-browses the active filter after an offering is deleted', () => {
    const actions$ = new ReplaySubject(1);
    const query = {
      q: 'guitar',
      level: '' as const,
      languages: ['English'],
      subjectIds: ['music'],
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CatalogEffects,
        provideMockActions(() => actions$),
        provideMockStore({
          initialState: {
            catalog: { ...initialCatalogState, query },
          },
        }),
      ],
    });
    const effects = TestBed.inject(CatalogEffects);
    const emitted: unknown[] = [];
    effects.refreshFilters$.subscribe((action) => emitted.push(action));
    actions$.next(OfferingsActions.removeSuccess({ id: 'o1' }));
    expect(emitted).toEqual([CatalogActions.browse(query)]);
  });

  it('does not browse when no filter list is loaded', () => {
    const actions$ = new ReplaySubject(1);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CatalogEffects,
        provideMockActions(() => actions$),
        provideMockStore({
          initialState: { catalog: initialCatalogState },
        }),
      ],
    });
    const effects = TestBed.inject(CatalogEffects);
    const emitted: unknown[] = [];
    effects.refreshFilters$.subscribe((action) => emitted.push(action));
    actions$.next(OfferingsActions.updateSuccess({
      offering: {
        id: 'o1',
        teacherId: 'teacher',
        title: 'Piano',
        description: 'Keys',
        level: 'beginner',
        createdAt: '2026-09-25T00:00:00.000Z',
        subjectId: null,
        subjectName: null,
      },
    }));
    expect(emitted).toEqual([]);
  });
});
