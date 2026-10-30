import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, switchMap, take } from 'rxjs';
import { ToastService } from '../../core/toast.service';
import { updateMe } from '../auth/auth.actions';
import { selectMe } from '../auth/auth.selectors';
import { OfferingLevel, OfferingsActions } from './offerings.actions';
import { selectOfferingsStatus } from './offerings.selectors';
import { SubjectInputComponent } from './subject-input';

@Component({
  selector: 'app-onboarding',
  imports: [ReactiveFormsModule, SubjectInputComponent],
  template: `
    <section class="auth-card">
      <h1>Publish an offering</h1>
      <p>Add a bio about you as a teacher, then publish your first offering.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          Bio
          <textarea formControlName="bio"></textarea>
        </label>
        <label>
          Title
          <input type="text" formControlName="title" />
        </label>
        <label>
          Description
          <textarea formControlName="description"></textarea>
        </label>
        <app-subject-input [control]="form.controls.subjectName" />
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
  private readonly toast = inject(ToastService);
  readonly me = this.store.selectSignal(selectMe);
  readonly status = this.store.selectSignal(selectOfferingsStatus);

  readonly form = this.fb.nonNullable.group({
    bio: ['', [Validators.required, Validators.minLength(10)]],
    title: ['', Validators.required],
    description: ['', Validators.required],
    subjectName: ['', Validators.required],
    level: this.fb.nonNullable.control<OfferingLevel>(
      'beginner',
      Validators.required,
    ),
  });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.toast.clear());
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
    const { bio, title, description, level, subjectName } = this.form.getRawValue();
    const me = this.me();
    this.store.dispatch(
      updateMe({
        name: me?.name ?? '',
        bio,
        avatarUrl: me?.avatarUrl ?? '',
        timezone: me?.timezone ?? 'UTC',
      }),
    );
    this.store.dispatch(
      OfferingsActions.create({ title, description, level, subjectName }),
    );
  }
}
