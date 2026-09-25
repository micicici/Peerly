import { Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { formatInTimezone } from '../../core/zoned-time';
import { selectMe } from '../auth/auth.selectors';
import { Booking, BookingsActions } from './bookings.actions';
import { selectMyBookings } from './bookings.selectors';
import { isJoinWindowOpen } from './join-window';

@Component({
  selector: 'app-bookings',
  template: `
    <section class="stack">
      <h1>Bookings</h1>
      @if (bookings().length === 0) {
        <p>No bookings yet.</p>
      }
      @for (booking of bookings(); track booking.id) {
        <article class="card">
          <h2>{{ role(booking) }}</h2>
          <p>{{ formatTime(booking.startAt) }}</p>
          <p class="meta">{{ booking.status }}</p>
          @if (booking.status === 'confirmed' && booking.joinUrl) {
            <p class="meta">Join URL: {{ booking.joinUrl }}</p>
            @if (joinOpen(booking)) {
              <a [href]="booking.joinUrl" target="_blank">Join</a>
            }
          }
          @if (canCancel(booking)) {
            <button type="button" class="danger" (click)="cancel(booking.id)">
              Cancel
            </button>
          }
        </article>
      }
    </section>
  `,
  styleUrls: ['../offerings/offerings.page.css', './bookings.page.css'],
})
export class BookingsPage {
  private readonly store = inject(Store);
  readonly me = this.store.selectSignal(selectMe);
  readonly bookings = this.store.selectSignal(selectMyBookings);

  constructor() {
    this.store.dispatch(BookingsActions.loadMine());
  }

  role(booking: Booking): string {
    return booking.teacherId === this.me()?.id ? 'Teaching' : 'Learning';
  }

  formatTime(iso: string): string {
    return formatInTimezone(iso, this.me()?.timezone || 'UTC');
  }

  joinOpen(booking: Booking): boolean {
    if (!booking.startAt || booking.status !== 'confirmed') {
      return false;
    }
    return isJoinWindowOpen(
      new Date(booking.startAt),
      new Date(),
      booking.status,
    );
  }

  canCancel(booking: Booking): boolean {
    const me = this.me();
    if (!me || !booking.startAt) {
      return false;
    }
    return (
      booking.teacherId === me.id &&
      new Date() < new Date(booking.startAt) &&
      booking.status === 'confirmed'
    );
  }

  cancel(id: string): void {
    this.store.dispatch(BookingsActions.cancel({ id }));
  }
}
