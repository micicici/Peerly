import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';

export type PendingReview = {
  teacherId: string;
  teacherName: string;
  required: boolean;
};

/** Tracks whether the signed-in learner still owes a review. */
@Injectable({ providedIn: 'root' })
export class ReviewPromptService {
  private readonly api = inject(ApiService);
  readonly pending = signal<PendingReview | null>(null);
  private readonly dismissed = new Set<string>();
  private readonly submitted = new Set<string>();

  refresh(): void {
    this.api.get<PendingReview | null>('/reviews/pending').subscribe({
      next: (pending) => this.apply(pending),
      error: () => this.pending.set(null),
    });
  }

  dismiss(): void {
    const current = this.pending();
    if (current) {
      this.dismissed.add(current.teacherId);
    }
    this.pending.set(null);
  }

  markSubmitted(teacherId: string): void {
    this.submitted.add(teacherId);
    if (this.pending()?.teacherId === teacherId) {
      this.pending.set(null);
    }
    this.refresh();
  }

  clear(): void {
    this.dismissed.clear();
    this.submitted.clear();
    this.pending.set(null);
  }

  private apply(pending: PendingReview | null): void {
    if (!pending || this.hidden(pending.teacherId)) {
      this.pending.set(null);
      return;
    }
    this.pending.set(pending);
  }

  private hidden(teacherId: string): boolean {
    return this.dismissed.has(teacherId) || this.submitted.has(teacherId);
  }
}
