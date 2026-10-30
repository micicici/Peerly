import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  isUtcOnTheHour,
  localDateHourToUtcIso,
} from '../../core/zoned-time';
import { ToastService } from '../../core/toast.service';
import { pastelsForSubjects, subjectColorKey } from '../../core/subject-pastel';
import { selectMe } from '../auth/auth.selectors';
import { WeeklyScheduleComponent } from '../schedule/weekly-schedule';
import { SlotsActions } from '../slots/slots.actions';
import { selectAllSlots } from '../slots/slots.selectors';
import { Offering, OfferingLevel, OfferingsActions } from './offerings.actions';
import { SubjectInputComponent } from './subject-input';
import {
  selectMyOfferings,
  selectOfferingsStatus,
} from './offerings.selectors';

@Component({
  selector: 'app-teach-offerings',
  imports: [ReactiveFormsModule, WeeklyScheduleComponent, SubjectInputComponent],
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
          Create offering
        </button>
      </form>

      <h2>Weekly slots</h2>
      <p class="meta">Click an hour to open it for every subject you teach. Click again to close it.</p>
      <app-weekly-schedule
        mode="teach"
        [slots]="slots()"
        [canOpenSlots]="hasOfferings()"
        (toggle)="openSlot($event)"
        (close)="removeSlot($event)"
      />

      <h2>Your offerings</h2>
      @for (offering of mine(); track offering.id) {
        <article
          class="card lesson-card"
          [style.background-color]="pastel(offering.subjectName).background"
          [style.border-color]="pastel(offering.subjectName).border"
          [style.border-top-color]="pastel(offering.subjectName).accent"
        >
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
              <app-subject-input [control]="editForm.controls.subjectName" />
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
            <p class="meta">{{ offering.subjectName || 'Subject' }} · {{ offering.level }}</p>
            <div class="row-actions">
              <button type="button" class="secondary" (click)="startEdit(offering)">
                Edit
              </button>
              <button
                type="button"
                class="danger"
                [disabled]="status() === 'loading'"
                (click)="askRemove(offering.id)"
              >
                Delete
              </button>
            </div>
          }
        </article>
      }
      @if (confirmingId(); as id) {
        <div class="modal-backdrop" (click)="closeRemove($event)">
          <div
            class="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-offering-title"
            (click)="$event.stopPropagation()"
          >
            <h2 id="delete-offering-title">Delete offering</h2>
            <p>Delete this offering? It will be removed from your profile and the catalog.</p>
            <div class="row-actions">
              <button type="button" class="danger" (click)="confirmRemove(id)">
                Delete offering
              </button>
              <button type="button" class="secondary" (click)="confirmingId.set(null)">
                Cancel
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
  styleUrls: ['./offerings.page.css', './teach-offerings.page.css'],
})
export class TeachOfferingsPage {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly actions$ = inject(Actions);
  private readonly toast = inject(ToastService);
  readonly me = this.store.selectSignal(selectMe);
  readonly mine = this.store.selectSignal(selectMyOfferings);
  readonly status = this.store.selectSignal(selectOfferingsStatus);
  readonly allSlots = this.store.selectSignal(selectAllSlots);
  readonly slots = computed(() => {
    const meId = this.me()?.id;
    if (!meId) {
      return [];
    }
    return this.allSlots().filter((slot) => slot.teacherId === meId);
  });
  readonly hasOfferings = computed(() => this.mine().length > 0);
  readonly editingId = signal<string | null>(null);
  readonly confirmingId = signal<string | null>(null);

  private readonly pastelBySubject = computed(() =>
    pastelsForSubjects(this.mine().map((offering) => offering.subjectName)),
  );

  pastel(subjectName: string | null | undefined) {
    return this.pastelBySubject().get(subjectColorKey(subjectName))!;
  }

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    subjectName: ['', Validators.required],
    level: this.fb.nonNullable.control<OfferingLevel>(
      'beginner',
      Validators.required,
    ),
  });

  readonly editForm = this.fb.nonNullable.group({
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
    this.editForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.toast.clear());
    this.store.dispatch(OfferingsActions.loadMine());
    this.store.dispatch(SlotsActions.loadMine());
    this.actions$
      .pipe(ofType(OfferingsActions.createSuccess), takeUntilDestroyed())
      .subscribe(() => {
        this.form.reset({
          title: '',
          description: '',
          subjectName: '',
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
    const { title, description, level, subjectName } = this.form.getRawValue();
    this.store.dispatch(
      OfferingsActions.create({ title, description, level, subjectName }),
    );
  }

  startEdit(offering: Offering): void {
    this.editingId.set(offering.id);
    this.editForm.setValue({
      title: offering.title,
      description: offering.description,
      subjectName: offering.subjectName ?? '',
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
    const { title, description, level, subjectName } = this.editForm.getRawValue();
    this.store.dispatch(
      OfferingsActions.update({ id, title, description, level, subjectName }),
    );
  }

  askRemove(id: string): void {
    this.confirmingId.set(id);
  }

  closeRemove(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.confirmingId.set(null);
    }
  }

  confirmRemove(id: string): void {
    this.confirmingId.set(null);
    this.store.dispatch(OfferingsActions.remove({ id }));
  }

  openSlot(local: Date): void {
    const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    const startAt = localDateHourToUtcIso(
      date,
      local.getHours(),
      this.me()?.timezone || 'UTC',
    );
    if (!isUtcOnTheHour(startAt)) {
      this.toast.show('Start must be on the UTC hour');
      return;
    }
    this.store.dispatch(SlotsActions.create({ startAt }));
  }

  removeSlot(id: string): void {
    this.store.dispatch(SlotsActions.remove({ id }));
  }
}
