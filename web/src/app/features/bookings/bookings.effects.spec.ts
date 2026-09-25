import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReplaySubject } from 'rxjs';
import { ToastService } from '../../core/toast.service';
import { BookingsEffects } from './bookings.effects';
import { BookingsActions } from './bookings.actions';

describe('BookingsEffects', () => {
  it('SLOT_GONE does not emit bookSuccess', () => {
    const actions$ = new ReplaySubject(1);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BookingsEffects,
        provideMockActions(() => actions$),
        provideMockStore({}),
      ],
    });
    const effects = TestBed.inject(BookingsEffects);
    const http = TestBed.inject(HttpTestingController);
    const outcomes: string[] = [];
    effects.book$.subscribe((a) => outcomes.push(a.type));
    actions$.next(BookingsActions.book({ slotId: 's1', offeringId: 'o1' }));
    http.expectOne('http://localhost:3000/bookings').flush(
      { code: 'SLOT_GONE', message: 'That hour was just taken.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(outcomes).toContain(BookingsActions.bookFailure.type);
    expect(outcomes).not.toContain(BookingsActions.bookSuccess.type);
  });

  it('INSUFFICIENT_HOURS toast points at Teach', () => {
    const actions$ = new ReplaySubject(1);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        BookingsEffects,
        provideMockActions(() => actions$),
        provideMockStore({}),
      ],
    });
    const effects = TestBed.inject(BookingsEffects);
    const http = TestBed.inject(HttpTestingController);
    const outcomes: string[] = [];
    effects.book$.subscribe((a) => outcomes.push(a.type));
    actions$.next(BookingsActions.book({ slotId: 's1', offeringId: 'o1' }));
    http.expectOne('http://localhost:3000/bookings').flush(
      { code: 'INSUFFICIENT_HOURS', message: 'Not enough hours.' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(TestBed.inject(ToastService).message()).toContain('Teach');
    expect(outcomes).toContain(BookingsActions.bookFailure.type);
    expect(outcomes).not.toContain(BookingsActions.bookSuccess.type);
  });
});
