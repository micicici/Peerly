import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectMe } from '../auth/auth.selectors';
import { OfferingLevel } from '../offerings/offerings.actions';
import { CatalogActions } from './catalog.actions';
import {
  selectCatalogOfferings,
  selectCatalogStatus,
} from './catalog.selectors';

@Component({
  selector: 'app-subjects',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section>
      <h1>Subjects</h1>
      <form class="filters" [formGroup]="filters" (ngSubmit)="search()">
        <label>
          Search
          <input type="search" formControlName="q" />
        </label>
        <label>
          Level
          <select formControlName="level" (change)="search()">
            <option value="">Any level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <button type="submit">Search</button>
      </form>
      @if (status() === 'loading' && offerings().length === 0) {
        <p>Loading offerings…</p>
      }
      <div class="cards">
        @for (offering of offerings(); track offering.id) {
          <article class="card">
            <h2>
              <a [routerLink]="['/subjects', offering.id]">{{ offering.title }}</a>
            </h2>
            <p class="meta">{{ offering.teacherName }} · {{ offering.level }}</p>
            <p>{{ offering.description }}</p>
            <p class="meta">{{ offering.openSlotCount }} open slots</p>
            @if (offering.teacherId !== me()?.id) {
              <button type="button">Book</button>
            }
          </article>
        }
      </div>
    </section>
  `,
  styleUrl: './catalog.page.css',
})
export class SubjectsPage {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  readonly me = this.store.selectSignal(selectMe);
  readonly offerings = this.store.selectSignal(selectCatalogOfferings);
  readonly status = this.store.selectSignal(selectCatalogStatus);

  readonly filters = this.fb.nonNullable.group({
    q: [''],
    level: this.fb.nonNullable.control<OfferingLevel | ''>(''),
  });

  constructor() {
    this.search();
  }

  search(): void {
    const { q, level } = this.filters.getRawValue();
    this.store.dispatch(CatalogActions.browse({ q, level }));
  }
}
