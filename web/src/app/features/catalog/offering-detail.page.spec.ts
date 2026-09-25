import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { OfferingDetailPage } from './offering-detail.page';

function state(balance: number) {
  return {
    auth: {
      token: 't',
      me: {
        id: 'learner',
        email: 'a@b.c',
        name: 'A',
        bio: null,
        avatarUrl: null,
        timezone: 'UTC',
        balance,
        offeringCount: 1,
      },
      status: 'idle',
      errorCode: null,
    },
    catalog: {
      ids: ['o1'],
      entities: {
        o1: {
          id: 'o1',
          teacherId: 'teacher',
          teacherName: 'Ada',
          title: 'Guitar',
          description: 'Chords',
          level: 'beginner',
          createdAt: '2026-09-25T00:00:00.000Z',
          openSlotCount: 1,
          confirmedBookingCount: 0,
        },
      },
      selectedId: 'o1',
      status: 'idle',
      errorCode: null,
    },
    slots: {
      ids: ['s1'],
      entities: {
        s1: {
          id: 's1',
          offeringId: 'o1',
          teacherId: 'teacher',
          startAt: '2026-09-26T10:00:00.000Z',
          endAt: '2026-09-26T11:00:00.000Z',
          status: 'open',
        },
      },
      status: 'idle',
      errorCode: null,
    },
  };
}

async function render(balance: number): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [OfferingDetailPage],
    providers: [
      provideRouter([]),
      provideMockStore({ initialState: state(balance) }),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: 'o1' })) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(OfferingDetailPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('OfferingDetailPage book control', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('disables Book and points at Teach when balance is below 1', async () => {
    const el = await render(0);
    const book = el.querySelector('button');
    expect(book?.textContent?.trim()).toBe('Book');
    expect(book?.hasAttribute('disabled')).toBe(true);
    const teach = el.querySelector('a[href="/teach"]');
    expect(teach?.textContent?.trim()).toBe('Teach');
  });

  it('leaves Book enabled when balance is at least 1', async () => {
    const el = await render(1);
    expect(el.querySelector('button')?.hasAttribute('disabled')).toBe(false);
    expect(el.querySelector('a[href="/teach"]')).toBeNull();
  });
});
