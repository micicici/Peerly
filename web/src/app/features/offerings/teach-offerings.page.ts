import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Offering, OfferingLevel, OfferingsActions } from './offerings.actions';
import {
  selectMyOfferings,
  selectOfferingsStatus,
} from './offerings.selectors';

@Component({
  selector: 'app-teach-offerings',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h1>Teach</h1>
      <form class="panel" [formGroup]="form" (ngSubmit)="submit()">
        <h2>New offering</h2>
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
          Create offering
        </button>
      </form>

      @for (offering of mine(); track offering.id) {
        <article class="card">
          @if (editingId() === offering.id) {
            <form [formGroup]="editForm" (ngSubmit)="saveEdit()">
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
              <div class="row-actions">
                <button type="submit" [disabled]="status() === 'loading'">
                  Save
                </button>
                <button type="button" class="secondary" (click)="cancelEdit()">
                  Cancel
                </button>
              </div>
            </form>
          } @else {
            <h2>{{ offering.title }}</h2>
            <p>{{ offering.description }}</p>
            <p class="meta">{{ offering.level }}</p>
            <div class="row-actions">
              <button type="button" class="secondary" (click)="startEdit(offering)">
                Edit
              </button>
              <button
                type="button"
                class="danger"
                [disabled]="status() === 'loading'"
                (click)="remove(offering.id)"
              >
                Delete
              </button>
            </div>
          }
        </article>
      }
    </section>
  `,
  styleUrl: './offerings.page.css',
})
export class TeachOfferingsPage {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly actions$ = inject(Actions);
  readonly mine = this.store.selectSignal(selectMyOfferings);
  readonly status = this.store.selectSignal(selectOfferingsStatus);
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    level: this.fb.nonNullable.control<OfferingLevel>(
      'beginner',
      Validators.required,
    ),
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    level: this.fb.nonNullable.control<OfferingLevel>(
      'beginner',
      Validators.required,
    ),
  });

  constructor() {
    this.store.dispatch(OfferingsActions.loadMine());
    this.actions$
      .pipe(ofType(OfferingsActions.createSuccess), takeUntilDestroyed())
      .subscribe(() => {
        this.form.reset({
          title: '',
          description: '',
          level: 'beginner',
        });
      });
    this.actions$
      .pipe(ofType(OfferingsActions.updateSuccess), takeUntilDestroyed())
      .subscribe(() => this.editingId.set(null));
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

  startEdit(offering: Offering): void {
    this.editingId.set(offering.id);
    this.editForm.setValue({
      title: offering.title,
      description: offering.description,
      level: offering.level,
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(): void {
    const id = this.editingId();
    if (!id || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const { title, description, level } = this.editForm.getRawValue();
    this.store.dispatch(
      OfferingsActions.update({ id, title, description, level }),
    );
  }

  remove(id: string): void {
    this.store.dispatch(OfferingsActions.remove({ id }));
  }
}
