import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectMe } from '../auth/auth.selectors';
import { CatalogActions } from './catalog.actions';
import {
  selectCatalogStatus,
  selectSelectedOffering,
} from './catalog.selectors';

@Component({
  selector: 'app-offering-detail',
  imports: [RouterLink],
  template: `
    <a class="back" routerLink="/subjects">Back to subjects</a>
    @if (offering(); as item) {
      <article class="detail">
        <h1>{{ item.title }}</h1>
        <p class="meta">{{ item.teacherName }} · {{ item.level }}</p>
        <p>{{ item.description }}</p>
        <p class="meta">
          {{ item.openSlotCount }} open slots ·
          {{ item.confirmedBookingCount }} confirmed bookings
        </p>
        @if (item.teacherId !== me()?.id) {
          <button type="button">Book</button>
        }
      </article>
    } @else if (status() === 'loading') {
      <p>Loading offering…</p>
    }
  `,
  styleUrl: './catalog.page.css',
})
export class OfferingDetailPage {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  readonly me = this.store.selectSignal(selectMe);
  readonly offering = this.store.selectSignal(selectSelectedOffering);
  readonly status = this.store.selectSignal(selectCatalogStatus);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.store.dispatch(CatalogActions.loadDetail({ id }));
      }
    });
  }
}
