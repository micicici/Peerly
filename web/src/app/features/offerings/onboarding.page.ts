import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, switchMap, take } from 'rxjs';
import { selectMe } from '../auth/auth.selectors';
import { OfferingLevel, OfferingsActions } from './offerings.actions';
import { selectOfferingsStatus } from './offerings.selectors';

@Component({
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule],
  template: `
    <section class="auth-card">
      <h1>Publish an offering</h1>
      <p>Publish your first offering to continue.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          Title
          <input type="text" formControlName="title" />
        </label>
        <label>
          Description
          <textarea formControlName="description"></textarea>
        </label>
        <label>
          Level
          <select formControlName="level">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <button type="submit" [disabled]="status() === 'loading'">
          Publish
        </button>
      </form>
    </section>
  `,
  styleUrls: ['../auth/auth.page.css', './offerings.page.css'],
})
export class OnboardingPage {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly actions$ = inject(Actions);
  readonly status = this.store.selectSignal(selectOfferingsStatus);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    level: this.fb.nonNullable.control<OfferingLevel>(
      'beginner',
      Validators.required,
    ),
  });

  constructor() {
    this.actions$
      .pipe(
        ofType(OfferingsActions.createSuccess),
        switchMap(() =>
          this.store.select(selectMe).pipe(
            filter((me) => me !== null && me.offeringCount >= 1),
            take(1),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        void this.router.navigateByUrl('/');
      });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description, level } = this.form.getRawValue();
    this.store.dispatch(
      OfferingsActions.create({ title, description, level }),
    );
  }
}
