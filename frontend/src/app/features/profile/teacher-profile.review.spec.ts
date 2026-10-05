import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { of, Subject } from 'rxjs';
import { ReviewPromptService } from '../reviews/review-prompt.service';
import { TeacherProfilePage } from './teacher-profile.page';

describe('TeacherProfilePage review prompt', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('hides the review form immediately and keeps a stale pending prompt hidden', async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherProfilePage, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        provideMockActions(() => new Subject()),
        provideMockStore({
          initialState: {
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
                balance: 2,
                offeringCount: 1,
              },
              status: 'idle',
              errorCode: null,
            },
            slots: { ids: [], entities: {}, status: 'idle', errorCode: null },
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'teacher' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TeacherProfilePage);
    const http = TestBed.inject(HttpTestingController);
    const prompt = TestBed.inject(ReviewPromptService);
    fixture.detectChanges();
    http.expectOne('http://localhost:3000/users/teacher').flush({
      id: 'teacher',
      name: 'Ada',
      bio: 'Piano and math teacher with a decade of studio work.',
      avatarUrl: null,
      gender: 'female',
      spokenLanguages: ['English'],
      timezone: 'UTC',
      offerings: [],
      avgRating: 4,
      ratingCount: 2,
      completedCount: 3,
    });
    http.expectOne('http://localhost:3000/users/teacher/reviews').flush([]);
    http.expectOne('http://localhost:3000/messages?with=teacher').flush([]);
    http.expectOne('http://localhost:3000/reviews/eligibility/teacher').flush({
      canReview: true,
      reason: null,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Leave a review');

    prompt.pending.set({
      teacherId: 'teacher',
      teacherName: 'Ada',
      required: true,
    });
    fixture.componentInstance.reviewBody = 'Great class today';
    fixture.componentInstance.submitReview();
    http.expectOne('http://localhost:3000/reviews').flush({ id: 'rev-1' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Leave a review');
    expect(prompt.pending()).toBeNull();

    http.expectOne('http://localhost:3000/reviews/pending').flush({
      teacherId: 'teacher',
      teacherName: 'Ada',
      required: true,
    });
    http.expectOne('http://localhost:3000/users/teacher/reviews').flush([
      {
        id: 'rev-1',
        authorName: 'A',
        rating: 5,
        body: 'Great class today',
        kind: 'review',
        createdAt: '2026-09-26T00:00:00.000Z',
      },
    ]);
    http.expectOne('http://localhost:3000/reviews/eligibility/teacher').flush({
      canReview: true,
      reason: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Leave a review');
    expect(prompt.pending()).toBeNull();
    http.verify();
  });
});
