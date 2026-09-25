import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { formatInTimezone, localDateHourToUtcIso } from '../../core/zoned-time';
import { selectMe } from '../auth/auth.selectors';
import { SlotsActions } from '../slots/slots.actions';
import { selectAllSlots, selectSlotsStatus } from '../slots/slots.selectors';
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

      <form class="panel" [formGroup]="slotForm" (ngSubmit)="openSlot()">
        <h2>Open an hour</h2>
        <label>
          Offering
          <select formControlName="offeringId">
            @for (offering of mine(); track offering.id) {
              <option [value]="offering.id">{{ offering.title }}</option>
            }
          </select>
        </label>
        <label>
          Date
          <input type="date" formControlName="date" />
        </label>
        <label>
          Hour ({{ me()?.timezone || 'UTC' }})
          <select formControlName="hour">
            @for (hour of hours; track hour) {
              <option [value]="hour">{{ hourLabel(hour) }}</option>
            }
          </select>
        </label>
        <button type="submit" [disabled]="slotStatus() === 'loading'">
          Open slot
        </button>
      </form>

      <h2>Your hours</h2>
      @for (slot of slots(); track slot.id) {
        <article class="card">
          <h2>{{ offeringTitle(slot.offeringId) }}</h2>
          <p>{{ formatTime(slot.startAt) }}</p>
          <p class="meta">{{ slot.status }}</p>
          @if (slot.status === 'open') {
            <button
              type="button"
              class="danger"
              [disabled]="slotStatus() === 'loading'"
              (click)="removeSlot(slot.id)"
            >
              Delete
            </button>
          }
        </article>
      }

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
  readonly slotStatus = this.store.selectSignal(selectSlotsStatus);
  readonly editingId = signal<string | null>(null);
  readonly hours = Array.from({ length: 24 }, (_, hour) => hour);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    level: this.fb.nonNullable.control<OfferingLevel>(
      'beginner',
      Validators.required,
    ),
  });

  readonly slotForm = this.fb.nonNullable.group({
    offeringId: ['', Validators.required],
    date: ['', Validators.required],
    hour: ['9', Validators.required],
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
    this.store.dispatch(SlotsActions.loadMine());
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
    this.actions$
      .pipe(
        ofType(OfferingsActions.loadMineSuccess, OfferingsActions.createSuccess),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.slotForm.controls.offeringId.value) {
          return;
        }
        const first = this.mine()[0];
        if (first) {
          this.slotForm.controls.offeringId.setValue(first.id);
        }
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

  hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  formatTime(iso: string): string {
    return formatInTimezone(iso, this.me()?.timezone || 'UTC');
  }

  offeringTitle(offeringId: string): string {
    return this.mine().find((offering) => offering.id === offeringId)?.title ?? 'Offering';
  }

  openSlot(): void {
    if (this.slotForm.invalid) {
      this.slotForm.markAllAsTouched();
      return;
    }
    const { offeringId, date, hour } = this.slotForm.getRawValue();
    const startAt = localDateHourToUtcIso(
      date,
      Number(hour),
      this.me()?.timezone || 'UTC',
    );
    this.store.dispatch(SlotsActions.create({ offeringId, startAt }));
  }

  removeSlot(id: string): void {
    this.store.dispatch(SlotsActions.remove({ id }));
  }
}
