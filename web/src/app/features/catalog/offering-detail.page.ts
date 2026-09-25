import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { formatInTimezone } from '../../core/zoned-time';
import { selectMe } from '../auth/auth.selectors';
import { BookingsActions } from '../bookings/bookings.actions';
import { Slot, SlotsActions } from '../slots/slots.actions';
import { selectAllSlots } from '../slots/slots.selectors';
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
        <h2>Open hours</h2>
        @for (slot of slots(); track slot.id) {
          <div class="slot-row">
            <span>{{ formatTime(slot.startAt) }}</span>
            @if (item.teacherId !== me()?.id) {
              <button type="button" (click)="book(slot)">Book</button>
            }
          </div>
        } @empty {
          <p>No open hours.</p>
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
  private readonly allSlots = this.store.selectSignal(selectAllSlots);
  readonly slots = computed(() => {
    const id = this.offering()?.id;
    if (!id) {
      return [];
    }
    return this.allSlots().filter(
      (slot) => slot.offeringId === id && slot.status === 'open',
    );
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.store.dispatch(CatalogActions.loadDetail({ id }));
        this.store.dispatch(SlotsActions.loadSlotsForOffering({ offeringId: id }));
      }
    });
  }

  formatTime(iso: string): string {
    return formatInTimezone(iso, this.me()?.timezone || 'UTC');
  }

  book(slot: Slot): void {
    const offering = this.offering();
    if (!offering) {
      return;
    }
    this.store.dispatch(
      BookingsActions.book({ slotId: slot.id, offeringId: offering.id }),
    );
  }
}
