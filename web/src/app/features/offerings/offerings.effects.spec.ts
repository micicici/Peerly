import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReplaySubject } from 'rxjs';
import { OfferingsEffects } from './offerings.effects';
import { OfferingsActions } from './offerings.actions';

describe('OfferingsEffects', () => {
  it('createOffering does not emit success on HTTP error', () => {
    const actions$ = new ReplaySubject(1);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OfferingsEffects,
        provideMockActions(() => actions$),
        provideMockStore({}),
      ],
    });
    const effects = TestBed.inject(OfferingsEffects);
    const http = TestBed.inject(HttpTestingController);
    const outcomes: string[] = [];
    effects.create$.subscribe((a) => outcomes.push(a.type));
    actions$.next(
      OfferingsActions.create({ title: 'G', description: 'd', level: 'beginner' }),
    );
    http
      .expectOne('http://localhost:3000/offerings')
      .flush({ code: 'INTERNAL', message: 'Try again.' }, { status: 500, statusText: 'err' });
    expect(outcomes).toContain(OfferingsActions.createFailure.type);
    expect(outcomes).not.toContain(OfferingsActions.createSuccess.type);
  });
});
