import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { of, Subject } from 'rxjs';
import { TeacherProfilePage } from '../profile/teacher-profile.page';

function state(balance: number) {
  return {
    auth: {
      token: 't',
      me: {
        id: 'learner',
        email: 'a@b.c',
        name: 'A',
        bio: 'I teach and learn together.',
        avatarUrl: null,
        gender: null,
        yearOfBirth: null,
        spokenLanguages: [],
        timezone: 'UTC',
        balance,
        offeringCount: 1,
      },
      status: 'idle',
      errorCode: null,
    },
    catalog: {
      ids: [],
      entities: {},
      selectedId: null,
      status: 'idle',
      errorCode: null,
    },
    slots: {
      ids: ['s1'],
      entities: {
        s1: {
          id: 's1',
          offeringId: null,
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
    imports: [TeacherProfilePage, HttpClientTestingModule],
    providers: [
      provideRouter([]),
      provideMockActions(() => new Subject()),
      provideMockStore({ initialState: state(balance) }),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ id: 'teacher' })),
          queryParamMap: of(convertToParamMap({ offeringId: 'o1' })),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TeacherProfilePage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne('http://localhost:3000/users/teacher').flush({
    id: 'teacher',
    name: 'Ada',
    bio: 'Piano and math teacher with a decade of studio work.',
    avatarUrl: null,
    gender: 'female',
    spokenLanguages: ['English'],
    timezone: 'UTC',
    offerings: [
      {
        id: 'o1',
        teacherId: 'teacher',
        title: 'Guitar',
        description: 'Chords',
        level: 'beginner',
        createdAt: '2026-09-25T00:00:00.000Z',
      },
    ],
    avgRating: 5,
    ratingCount: 1,
    completedCount: 2,
  });
  http.expectOne('http://localhost:3000/users/teacher/reviews').flush([]);
  http.expectOne('http://localhost:3000/messages?with=teacher').flush([]);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TeacherProfilePage book control', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('points at Teach when balance is below 1', async () => {
    const el = await render(0);
    const teach = el.querySelector('a[href="/teach"]');
    expect(teach?.textContent?.trim()).toBe('Teach');
  });

  it('does not show the hours warning when balance is at least 1', async () => {
    const el = await render(1);
    expect(el.querySelector('a[href="/teach"]')).toBeNull();
  });
});
