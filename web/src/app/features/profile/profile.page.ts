import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { filter, take } from 'rxjs';
import { formatInTimezone } from '../../core/zoned-time';
import { updateMe } from '../auth/auth.actions';
import { selectMe } from '../auth/auth.selectors';
import type { MeDto } from '../auth/auth.reducer';
import { OfferingsActions } from '../offerings/offerings.actions';
import { selectMyOfferings } from '../offerings/offerings.selectors';
import { LedgerActions } from '../ledger/ledger.actions';
import {
  selectBalance,
  selectLedgerEntries,
} from '../ledger/ledger.selectors';

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule],
  template: `
    <section class="stack">
      <h1>Profile</h1>
      <p class="balance">{{ balance() }} hours</p>
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
          Avatar URL
          <input type="url" formControlName="avatarUrl" />
        </label>
        <label>
          Timezone
          <input type="text" formControlName="timezone" />
        </label>
        <button type="submit">Save profile</button>
      </form>

      <h2>My offerings</h2>
      @for (offering of offerings(); track offering.id) {
        <article class="card">
          <h2>{{ offering.title }}</h2>
          <p>{{ offering.description }}</p>
          <p class="meta">{{ offering.level }}</p>
        </article>
      }

      <h2>Ledger</h2>
      @if (entries().length === 0) {
        <p>No ledger entries yet.</p>
      }
      @for (entry of entries(); track entry.id) {
        <article class="card">
          <p>
            {{ entry.type }}
            {{ entry.amount > 0 ? '+' : '' }}{{ entry.amount }}
          </p>
          <p class="meta">{{ formatTime(entry.createdAt) }}</p>
        </article>
      }
    </section>
  `,
  styleUrls: ['../offerings/offerings.page.css', './profile.page.css'],
})
export class ProfilePage {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  readonly me = this.store.selectSignal(selectMe);
  readonly balance = this.store.selectSignal(selectBalance);
  readonly offerings = this.store.selectSignal(selectMyOfferings);
  readonly entries = this.store.selectSignal(selectLedgerEntries);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    bio: [''],
    avatarUrl: [''],
    timezone: ['UTC', Validators.required],
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
          avatarUrl: me.avatarUrl ?? '',
          timezone: me.timezone,
        });
      });
  }

  formatTime(iso: string): string {
    return formatInTimezone(iso, this.me()?.timezone || 'UTC');
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, bio, avatarUrl, timezone } = this.form.getRawValue();
    this.store.dispatch(updateMe({ name, bio, avatarUrl, timezone }));
  }
}
