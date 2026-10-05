import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { filter, take } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { displayAvatar } from '../../core/avatar';
import {
  BIRTH_YEAR_PLACEHOLDER,
  birthYearValidator,
  parseBirthYear,
} from '../../core/birth-year';
import { parseLanguages } from '../../core/languages';
import { pastelsForSubjects, subjectColorKey } from '../../core/subject-pastel';
import { formatInTimezone } from '../../core/zoned-time';
import { updateMe, uploadAvatar } from '../auth/auth.actions';
import { selectMe } from '../auth/auth.selectors';
import type { MeDto } from '../auth/auth.reducer';
import {
  Offering,
  OfferingLevel,
  OfferingsActions,
} from '../offerings/offerings.actions';
import { SubjectInputComponent } from '../offerings/subject-input';
import { selectMyOfferings } from '../offerings/offerings.selectors';
import { LedgerActions, LedgerEntry } from '../ledger/ledger.actions';
import { LessonMaterials } from '../ledger/lesson-materials';
import {
  selectBalance,
  selectLedgerEntries,
} from '../ledger/ledger.selectors';

function hasLanguage(control: AbstractControl): ValidationErrors | null {
  return parseLanguages(String(control.value ?? '')).length > 0
    ? null
    : { required: true };
}

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, SubjectInputComponent, LessonMaterials],
  template: `
    <section class="stack">
      <h1>Profile</h1>
      <p class="balance">{{ balance() }} hours</p>
      <img class="avatar" [src]="avatar()" alt="" />
      <form class="panel" [formGroup]="form" (ngSubmit)="save()">
        <label>
          Name
          <input type="text" formControlName="name" />
        </label>
        <label>
          Bio
          <textarea formControlName="bio"></textarea>
        </label>
        <label>
          Gender
          <select formControlName="gender">
            <option value="" disabled>Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label>
          Year of birth
          <input
            type="text"
            inputmode="numeric"
            autocomplete="bday-year"
            formControlName="yearOfBirth"
            placeholder="{{ birthYearPlaceholder }}"
            maxlength="4"
          />
          @if (yearError(); as message) {
            <span class="form-error" role="alert">{{ message }}</span>
          }
        </label>
        <label>
          Spoken languages
          <input type="text" formControlName="spokenLanguages" placeholder="English, Serbian" />
        </label>
        <label>
          Profile picture
          <input type="file" accept="image/*" (change)="onFile($event)" />
        </label>
        <label>
          Timezone
          <input type="text" formControlName="timezone" />
        </label>
        <button type="submit">Save profile</button>
      </form>

      <h2>My offerings</h2>
      @for (offering of offerings(); track offering.id) {
        <article
          class="card lesson-card"
          [style.background-color]="pastel(offering.subjectName).background"
          [style.border-color]="pastel(offering.subjectName).border"
          [style.border-top-color]="pastel(offering.subjectName).accent"
        >
          <h2>{{ offering.title }}</h2>
          <p>{{ offering.description }}</p>
          <p class="meta">{{ offering.subjectName || 'Subject' }} · {{ offering.level }}</p>
          <div class="row-actions">
            <button type="button" class="secondary" (click)="startEdit(offering)">
              Edit
            </button>
            <button type="button" class="danger" (click)="askDelete(offering.id)">
              Delete
            </button>
          </div>
        </article>
      }

      @if (editingId()) {
        <div class="modal-backdrop" (click)="closeEdit($event)">
          <form
            class="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-offering-title"
            [formGroup]="editForm"
            (ngSubmit)="saveEdit()"
            (click)="$event.stopPropagation()"
          >
            <h2 id="edit-offering-title">Edit offering</h2>
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
              <button type="submit">Save</button>
              <button type="button" class="secondary" (click)="editingId.set(null)">
                Cancel
              </button>
            </div>
          </form>
        </div>
      }

      @if (confirmingId(); as id) {
        <div class="modal-backdrop" (click)="closeDelete($event)">
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
              <button type="button" class="danger" (click)="confirmDelete(id)">
                Delete offering
              </button>
              <button type="button" class="secondary" (click)="confirmingId.set(null)">
                Cancel
              </button>
            </div>
          </div>
        </div>
      }

      <h2>Ledger</h2>
      @if (entries().length === 0) {
        <p>No ledger entries yet.</p>
      }
      @for (entry of entries(); track entry.id) {
        <article class="card">
          <p>{{ ledgerText(entry) }}</p>
          <p class="meta">
            {{ entry.amount > 0 ? '+' : '' }}{{ entry.amount }} ·
            {{ formatTime(entry.createdAt) }}
          </p>
          @if (entry.bookingId) {
            <app-lesson-materials
              [bookingId]="entry.bookingId"
              [materials]="entry.materials"
              [canAttach]="canAttachMaterial(entry)"
              (changed)="reloadLedger()"
            />
          }
        </article>
      }
    </section>
  `,
  styleUrls: ['../offerings/offerings.page.css', './profile.page.css'],
})
export class ProfilePage {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  readonly editingId = signal<string | null>(null);
  readonly confirmingId = signal<string | null>(null);
  readonly me = this.store.selectSignal(selectMe);
  readonly birthYearPlaceholder = BIRTH_YEAR_PLACEHOLDER;
  readonly balance = this.store.selectSignal(selectBalance);
  readonly offerings = this.store.selectSignal(selectMyOfferings);
  readonly entries = this.store.selectSignal(selectLedgerEntries);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    bio: ['', [Validators.required, Validators.minLength(10)]],
    timezone: ['UTC', Validators.required],
    gender: this.fb.nonNullable.control<'' | 'male' | 'female'>(
      '',
      Validators.required,
    ),
    yearOfBirth: ['', [Validators.required, birthYearValidator]],
    spokenLanguages: ['', hasLanguage],
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    subjectName: ['', Validators.required],
    level: this.fb.nonNullable.control<OfferingLevel>('beginner', Validators.required),
  });

  constructor() {
    this.store.dispatch(OfferingsActions.loadMine());
    this.store.dispatch(LedgerActions.load());
    this.store
      .select(selectMe)
      .pipe(
        filter((me): me is MeDto => me !== null),
        take(1),
        takeUntilDestroyed(),
      )
      .subscribe((me) => {
        this.form.setValue({
          name: me.name,
          bio: me.bio ?? '',
          timezone: me.timezone,
          gender: me.gender ?? '',
          yearOfBirth:
            me.yearOfBirth == null ? '' : String(me.yearOfBirth),
          spokenLanguages: (me.spokenLanguages ?? []).join(', '),
        });
      });
    this.actions$
      .pipe(ofType(OfferingsActions.updateSuccess), takeUntilDestroyed())
      .subscribe(() => this.editingId.set(null));
  }

  avatar(): string {
    return displayAvatar(this.api.assetUrl(this.me()?.avatarUrl), this.me()?.gender);
  }

  private readonly pastelBySubject = computed(() =>
    pastelsForSubjects(this.offerings().map((offering) => offering.subjectName)),
  );

  pastel(subjectName: string | null | undefined) {
    return this.pastelBySubject().get(subjectColorKey(subjectName))!;
  }

  yearError(): string | null {
    const control = this.form.controls.yearOfBirth;
    if (control.valid || !control.touched) {
      return null;
    }
    return 'Enter a valid year of birth.';
  }

  ledgerText(entry: LedgerEntry): string {
    const subject = entry.subjectName || entry.classTitle;
    if (!subject) {
      return entry.type === 'starter' ? 'Starter credit' : entry.type;
    }
    const className =
      entry.classTitle && entry.subjectName && entry.classTitle !== entry.subjectName
        ? `${entry.subjectName} — ${entry.classTitle}`
        : subject;
    if (!entry.counterpartName) {
      return className;
    }
    const role = entry.counterpartRole === 'student' ? 'student' : 'teacher';
    return `${className} with ${role} ${entry.counterpartName}`;
  }

  formatTime(iso: string): string {
    return formatInTimezone(iso, this.me()?.timezone || 'UTC');
  }

  canAttachMaterial(entry: LedgerEntry): boolean {
    return (
      entry.counterpartRole === 'student' && entry.bookingStatus === 'confirmed'
    );
  }

  reloadLedger(): void {
    this.store.dispatch(LedgerActions.load());
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.store.dispatch(uploadAvatar({ file }));
    }
  }

  startEdit(offering: Offering): void {
    this.confirmingId.set(null);
    this.editingId.set(offering.id);
    this.editForm.setValue({
      title: offering.title,
      description: offering.description,
      subjectName: offering.subjectName ?? '',
      level: offering.level,
    });
  }

  closeEdit(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.editingId.set(null);
    }
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

  askDelete(id: string): void {
    this.editingId.set(null);
    this.confirmingId.set(id);
  }

  closeDelete(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.confirmingId.set(null);
    }
  }

  confirmDelete(id: string): void {
    this.confirmingId.set(null);
    this.store.dispatch(OfferingsActions.remove({ id }));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, bio, timezone, gender, yearOfBirth, spokenLanguages } =
      this.form.getRawValue();
    const birthYear = parseBirthYear(yearOfBirth);
    if (!gender || birthYear == null) {
      return;
    }
    this.store.dispatch(
      updateMe({
        name,
        bio,
        avatarUrl: this.me()?.avatarUrl ?? '',
        timezone,
        gender,
        yearOfBirth: birthYear,
        spokenLanguages: parseLanguages(spokenLanguages),
      }),
    );
  }
}
