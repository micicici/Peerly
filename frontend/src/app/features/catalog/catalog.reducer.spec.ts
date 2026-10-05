import { CatalogActions, CatalogOffering } from './catalog.actions';
import { catalogReducer, initialCatalogState } from './catalog.reducer';
import { OfferingsActions } from '../offerings/offerings.actions';

const listed: CatalogOffering = {
  id: 'o1',
  teacherId: 'teacher',
  teacherName: 'Ada',
  title: 'Guitar',
  description: 'Chords',
  level: 'beginner',
  subjectId: 'music',
  subjectName: 'Music',
  createdAt: '2026-09-25T00:00:00.000Z',
  openSlotCount: 2,
  confirmedBookingCount: 1,
};

describe('catalogReducer offering edits', () => {
  it('drops a deleted offering from the current filter list', () => {
    const loaded = catalogReducer(
      initialCatalogState,
      CatalogActions.browseSuccess({ offerings: [listed] }),
    );
    const next = catalogReducer(loaded, OfferingsActions.removeSuccess({ id: 'o1' }));
    expect(next.ids).toEqual([]);
  });

  it('updates title and subject in the current filter list', () => {
    const loaded = catalogReducer(
      initialCatalogState,
      CatalogActions.browseSuccess({ offerings: [listed] }),
    );
    const next = catalogReducer(
      loaded,
      OfferingsActions.updateSuccess({
        offering: {
          id: 'o1',
          teacherId: 'teacher',
          title: 'Piano',
          description: 'Keys',
          level: 'intermediate',
          createdAt: listed.createdAt,
          subjectId: 'keys',
          subjectName: 'Keys',
        },
      }),
    );
    expect(next.entities['o1']).toEqual(
      jasmine.objectContaining({
        title: 'Piano',
        description: 'Keys',
        level: 'intermediate',
        subjectName: 'Keys',
        teacherName: 'Ada',
      }),
    );
  });
});
