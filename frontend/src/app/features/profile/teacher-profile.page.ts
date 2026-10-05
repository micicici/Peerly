import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { combineLatest } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { displayAvatar } from '../../core/avatar';
import { ToastService } from '../../core/toast.service';
import { selectIsAuthed, selectMe } from '../auth/auth.selectors';
import { BookingsActions } from '../bookings/bookings.actions';
import { Offering } from '../offerings/offerings.actions';
import { StarRatingComponent } from '../ratings/star-rating';
import { ReviewPromptService } from '../reviews/review-prompt.service';
import { WeeklyScheduleComponent } from '../schedule/weekly-schedule';
import { Slot, SlotsActions } from '../slots/slots.actions';
import { selectAllSlots } from '../slots/slots.selectors';

type PublicTeacher = {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  gender: 'male' | 'female' | null;
  spokenLanguages: string[];
  timezone: string;
  offerings: Offering[];
  avgRating: number;
  ratingCount: number;
  completedCount: number;
};

type ReviewRow = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  kind: 'review' | 'report';
  createdAt: string;
};

type ChatMessage = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
};

type ReviewAccess = {
  canReview: boolean;
  reason: string | null;
};

@Component({
  selector: 'app-teacher-profile',
  imports: [RouterLink, FormsModule, WeeklyScheduleComponent, StarRatingComponent],
  template: `
    @if (teacher(); as t) {
      <div class="profile-screen">
        <div class="profile-top">
          <a class="back" routerLink="/subjects">Back to subjects</a>
          <div class="hero">
            <img class="avatar" [src]="avatar()" alt="" />
            <div>
              <h1>{{ t.name }}</h1>
              <p class="meta">
                <app-star-rating [rating]="t.avgRating" />
                · {{ t.ratingCount }} ratings ·
                {{ t.completedCount }} completed classes
              </p>
              <p>{{ t.bio }}</p>
              @if (t.spokenLanguages.length > 0) {
                <p class="meta">Speaks {{ t.spokenLanguages.join(', ') }}</p>
              }
              <p class="meta">
                @for (offering of t.offerings; track offering.id) {
                  <span class="subject">{{ offering.title }} ({{ offering.level }})</span>
                }
              </p>
            </div>
          </div>
        </div>
        <section class="schedule-stage">
          <h2>Weekly slots</h2>
          @if (!authed()) {
            <p class="meta">Log in to book a session.</p>
          } @else if (t.id !== me()?.id && (me()?.balance ?? 0) < 1) {
            <p class="meta">
              Not enough hours.
              <a routerLink="/teach">Teach</a> to earn more.
            </p>
          }
          <app-weekly-schedule
            mode="book"
            [slots]="slots()"
            [subjectLabel]="subjectLabel()"
            [revertSlotId]="revertSlotId()"
            [revertNonce]="revertNonce()"
            (selectSlot)="onSelectSlot($event)"
            (book)="confirmBook($event)"
          />
        </section>
      </div>

      <section class="reviews-block">
        <h2>Reviews</h2>
        @for (review of reviews(); track review.id) {
          <article class="card">
            <p class="meta">
              {{ review.kind === 'report' ? 'Report / Appeal' : 'Review' }}
              · <app-star-rating [rating]="review.rating" /> · {{ review.authorName }}
            </p>
            <p>{{ review.body }}</p>
          </article>
        } @empty {
          <p>No comments yet.</p>
        }

        @if (authed() && t.id !== me()?.id) {
          @if (reviewAccess()?.canReview) {
            <form class="panel" (ngSubmit)="submitReview()">
              <h2>Leave a review</h2>
              <label>
                Rating
                <select [(ngModel)]="reviewRating" name="rating">
                  @for (n of [1, 2, 3, 4, 5]; track n) {
                    <option [ngValue]="n">{{ n }} star{{ n === 1 ? '' : 's' }}</option>
                  }
                </select>
              </label>
              <label>
                Comment
                <textarea [(ngModel)]="reviewBody" name="reviewBody" required></textarea>
              </label>
              <button type="submit">Publish review</button>
            </form>
          } @else if (reviewAccess()?.reason) {
            <p class="form-error" role="status">{{ reviewAccess()?.reason }}</p>
          }
          <form class="panel" (ngSubmit)="submitReport()">
            <h2>Report / Appeal</h2>
            <label>
              What happened?
              <textarea [(ngModel)]="reportBody" name="reportBody" required></textarea>
            </label>
            <button type="submit" class="danger">Submit report</button>
          </form>
        }
      </section>

      @if (t.id !== me()?.id) {
        <button
          type="button"
          class="chat-fab"
          [attr.aria-expanded]="chatOpen()"
          aria-label="Ask a question"
          (click)="chatOpen.set(!chatOpen())"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H9l-3.5 3.2V6.5z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        @if (chatOpen()) {
          <aside class="chat-dock">
            <div class="chat-head">
              <h2>Ask a question</h2>
              <button type="button" class="chat-close" aria-label="Close chat" (click)="chatOpen.set(false)">
                ×
              </button>
            </div>
            @if (authed()) {
              <div class="chat-log">
                @for (msg of messages(); track msg.id) {
                  <p class="chat-row" [class.mine]="msg.fromId === me()?.id">
                    {{ msg.body }}
                  </p>
                }
              </div>
              <form (ngSubmit)="sendChat()">
                <textarea name="chat" [(ngModel)]="draft" required></textarea>
                <button type="submit">Send</button>
              </form>
            } @else {
              <p class="meta"><a routerLink="/login">Log in</a> to message this teacher.</p>
            }
          </aside>
        }
      }
    }
  `,
  styleUrls: ['../catalog/catalog.page.css', './teacher-profile.page.css'],
})
export class TeacherProfilePage {
  private readonly store = inject(Store);
  private readonly actions = inject(Actions);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly prompt = inject(ReviewPromptService);
  private readonly reviewedTeachers = new Set<string>();
  readonly me = this.store.selectSignal(selectMe);
  readonly authed = this.store.selectSignal(selectIsAuthed);
  readonly teacher = signal<PublicTeacher | null>(null);
  readonly reviews = signal<ReviewRow[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly reviewAccess = signal<ReviewAccess | null>(null);
  readonly revertSlotId = signal<string | null>(null);
  readonly revertNonce = signal(0);
  readonly chatOpen = signal(false);
  readonly offeringIndex = signal(0);
  readonly selectedSlotId = signal<string | null>(null);
  draft = '';
  reviewRating = 5;
  reviewBody = '';
  reportBody = '';

  private readonly allSlots = this.store.selectSignal(selectAllSlots);
  readonly slots = computed(() => {
    const id = this.teacher()?.id;
    if (!id) {
      return [];
    }
    return this.allSlots().filter((slot) => slot.teacherId === id);
  });

  readonly currentOffering = computed(() => {
    const offerings = this.teacher()?.offerings ?? [];
    if (offerings.length === 0) {
      return null;
    }
    return offerings[this.offeringIndex() % offerings.length];
  });

  readonly subjectLabel = computed(
    () => this.currentOffering()?.title ?? 'Book',
  );

  readonly avatar = computed(() =>
    displayAvatar(
      this.api.assetUrl(this.teacher()?.avatarUrl),
      this.teacher()?.gender,
    ),
  );

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, query]) => {
        const id = params.get('id');
        if (!id) {
          return;
        }
        this.loadTeacher(id, query.get('offeringId'));
        this.store.dispatch(SlotsActions.loadSlotsForTeacher({ teacherId: id }));
        if (this.authed()) {
          this.api.get<ChatMessage[]>(`/messages?with=${id}`).subscribe({
            next: (rows) => this.messages.set(rows),
            error: () => this.messages.set([]),
          });
          this.loadReviewAccess(id);
        } else {
          this.reviewAccess.set(null);
        }
      });
    this.actions
      .pipe(ofType(BookingsActions.bookFailure), takeUntilDestroyed())
      .subscribe(({ slotId, errorCode }) => {
        if (slotId && errorCode !== 'SLOT_GONE') {
          this.releaseBookedSlot(slotId);
        }
      });
  }

  onSelectSlot(slot: Slot): void {
    if (this.selectedSlotId() === slot.id) {
      const count = this.teacher()?.offerings.length ?? 1;
      this.offeringIndex.update((i) => (i + 1) % count);
      return;
    }
    this.selectedSlotId.set(slot.id);
  }

  confirmBook(slot: Slot): void {
    const offering = this.currentOffering();
    const teacher = this.teacher();
    if (!offering || !teacher) {
      this.releaseBookedSlot(slot.id);
      return;
    }
    if (!this.authed()) {
      this.releaseBookedSlot(slot.id);
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    if (teacher.id === this.me()?.id) {
      this.releaseBookedSlot(slot.id);
      this.toast.show('You cannot book your own hour.');
      return;
    }
    if ((this.me()?.balance ?? 0) < 1) {
      this.releaseBookedSlot(slot.id);
      return;
    }
    this.store.dispatch(
      BookingsActions.book({ slotId: slot.id, offeringId: offering.id }),
    );
  }

  sendChat(): void {
    const teacher = this.teacher();
    const body = this.draft.trim();
    if (!teacher || !body) {
      return;
    }
    this.api.post<ChatMessage>('/messages', { toId: teacher.id, body }).subscribe({
      next: (msg) => {
        this.messages.update((rows) => [...rows, msg]);
        this.draft = '';
      },
      error: () => this.toast.show('Could not send message'),
    });
  }

  submitReview(): void {
    const teacher = this.teacher();
    if (!teacher || this.reviewBody.trim().length < 3) {
      return;
    }
    this.api
      .post('/reviews', {
        teacherId: teacher.id,
        rating: this.reviewRating,
        body: this.reviewBody.trim(),
      })
      .subscribe({
        next: () => {
          this.reviewedTeachers.add(teacher.id);
          this.reviewAccess.set({ canReview: false, reason: null });
          this.prompt.markSubmitted(teacher.id);
          this.reviewBody = '';
          this.reloadReviews(teacher.id);
          this.loadReviewAccess(teacher.id);
        },
        error: (err: { error?: { message?: string } }) =>
          this.toast.show(err.error?.message ?? 'Could not publish review'),
      });
  }

  submitReport(): void {
    const teacher = this.teacher();
    if (!teacher || this.reportBody.trim().length < 3) {
      return;
    }
    this.api
      .post('/reports', { teacherId: teacher.id, body: this.reportBody.trim() })
      .subscribe({
        next: () => {
          this.reportBody = '';
          this.reloadReviews(teacher.id);
        },
        error: () => this.toast.show('Could not submit report'),
      });
  }

  private loadTeacher(id: string, offeringId: string | null): void {
    this.api.get<PublicTeacher>(`/users/${id}`).subscribe({
      next: (teacher) => {
        this.teacher.set(teacher);
        const idx = teacher.offerings.findIndex((o) => o.id === offeringId);
        this.offeringIndex.set(idx >= 0 ? idx : 0);
      },
    });
    this.reloadReviews(id);
  }

  private reloadReviews(id: string): void {
    this.api.get<ReviewRow[]>(`/users/${id}/reviews`).subscribe({
      next: (rows) => this.reviews.set(rows),
    });
  }

  private releaseBookedSlot(slotId: string): void {
    this.revertSlotId.set(slotId);
    this.revertNonce.update((n) => n + 1);
  }

  private loadReviewAccess(teacherId: string): void {
    if (!this.authed() || this.me()?.id === teacherId) {
      this.reviewAccess.set(null);
      return;
    }
    this.api.get<ReviewAccess>(`/reviews/eligibility/${teacherId}`).subscribe({
      next: (access) => {
        if (this.reviewedTeachers.has(teacherId)) {
          this.reviewAccess.set({
            canReview: false,
            reason: access.canReview ? null : access.reason,
          });
          return;
        }
        this.reviewAccess.set(access);
      },
      error: () =>
        this.reviewAccess.set({
          canReview: false,
          reason:
            'You can leave a review after you complete a class with this teacher.',
        }),
    });
  }
}
