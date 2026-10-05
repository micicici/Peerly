import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { interval } from 'rxjs';
import { formatInTimezone } from '../../core/zoned-time';
import { selectMe } from '../auth/auth.selectors';
import { Booking, BookingsActions } from './bookings.actions';
import { selectMyBookings } from './bookings.selectors';
import { joinAvailability, joinCountdown } from './join-window';
import { LessonMaterials } from '../ledger/lesson-materials';

@Component({
  selector: 'app-bookings',
  imports: [LessonMaterials],
  template: `
    <section class="stack">
      <h1>Class history</h1>
      @if (bookings().length === 0) {
        <p>No classes yet.</p>
      }
      @for (booking of bookings(); track booking.id) {
        <article class="card">
          <h2>{{ classLabel(booking) }}</h2>
          <p>{{ counterpart(booking) }}</p>
          <p>{{ formatTime(booking.startAt) }}</p>
          <p class="meta">{{ role(booking) }} · {{ booking.status }}</p>
          @if (availability(booking) === 'open') {
            <button type="button" class="join" (click)="join(booking)">
              Join Class
            </button>
          } @else if (availability(booking) === 'waiting') {
            <p class="meta join-status">Available 10m before class</p>
            @if (countdown(booking); as label) {
              <p class="meta join-status">{{ label }}</p>
            }
          } @else if (availability(booking) === 'ended') {
            <p class="meta join-status">Class ended</p>
          }
          @if (canCancel(booking)) {
            <button type="button" class="danger" (click)="cancel(booking.id)">
              Cancel
            </button>
          }
          <app-lesson-materials
            [bookingId]="booking.id"
            [materials]="booking.materials"
            [canAttach]="canAttach(booking)"
            (changed)="reload()"
          />
        </article>
      }
    </section>
  `,
  styleUrls: ['../offerings/offerings.page.css', './bookings.page.css'],
})
export class BookingsPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  readonly me = this.store.selectSignal(selectMe);
  readonly bookings = this.store.selectSignal(selectMyBookings);
  private readonly now = signal(Date.now());

  constructor() {
    this.store.dispatch(BookingsActions.loadMine());
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
  }

  role(booking: Booking): string {
    return booking.teacherId === this.me()?.id ? 'Teaching' : 'Learning';
  }

  classLabel(booking: Booking): string {
    const subject = booking.subjectName || booking.offeringTitle || 'Class';
    if (
      booking.offeringTitle &&
      booking.subjectName &&
      booking.offeringTitle !== booking.subjectName
    ) {
      return `${booking.subjectName} — ${booking.offeringTitle}`;
    }
    return subject;
  }

  counterpart(booking: Booking): string {
    if (booking.teacherId === this.me()?.id) {
      return `Student: ${booking.learnerName}`;
    }
    return `Teacher: ${booking.teacherName}`;
  }

  formatTime(iso: string): string {
    return formatInTimezone(iso, this.me()?.timezone || 'UTC');
  }

  availability(booking: Booking): 'hidden' | 'waiting' | 'open' | 'ended' {
    if (!booking.startAt) {
      return 'hidden';
    }
    return joinAvailability(
      new Date(booking.startAt),
      new Date(this.now()),
      booking.status,
    );
  }

  countdown(booking: Booking): string | null {
    if (!booking.startAt || this.availability(booking) !== 'waiting') {
      return null;
    }
    return joinCountdown(new Date(booking.startAt), new Date(this.now()));
  }

  join(booking: Booking): void {
    if (this.availability(booking) !== 'open') {
      return;
    }
    void this.router.navigate(['/classroom', booking.id]);
  }

  canAttach(booking: Booking): boolean {
    return booking.teacherId === this.me()?.id && booking.status === 'confirmed';
  }

  reload(): void {
    this.store.dispatch(BookingsActions.loadMine());
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
