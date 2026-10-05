import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PendingReview, ReviewPromptService } from './review-prompt.service';

describe('ReviewPromptService', () => {
  let service: ReviewPromptService;
  let http: HttpTestingController;

  const pending: PendingReview = {
    teacherId: 'teacher-1',
    teacherName: 'Ada',
    required: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ReviewPromptService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('hides the banner as soon as it is dismissed and ignores a later refresh', () => {
    service.pending.set(pending);
    service.dismiss();
    expect(service.pending()).toBeNull();

    service.refresh();
    http
      .expectOne('http://localhost:3000/reviews/pending')
      .flush(pending);
    expect(service.pending()).toBeNull();
  });

  it('hides the banner on submit and does not restore that teacher', () => {
    service.pending.set(pending);
    service.markSubmitted('teacher-1');
    expect(service.pending()).toBeNull();

    http.expectOne('http://localhost:3000/reviews/pending').flush(pending);
    expect(service.pending()).toBeNull();
  });

  it('shows the next teacher the backend still marks as pending', () => {
    service.markSubmitted('teacher-1');
    http.expectOne('http://localhost:3000/reviews/pending').flush({
      teacherId: 'teacher-2',
      teacherName: 'Grace',
      required: true,
    });
    expect(service.pending()).toEqual({
      teacherId: 'teacher-2',
      teacherName: 'Grace',
      required: true,
    });
  });
});
