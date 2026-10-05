import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  template: `
    <span class="stars" role="img" [attr.aria-label]="label()">
      @for (filled of stars(); track $index) {
        <svg
          class="star"
          [class.filled]="filled"
          [class.empty]="!filled"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 2.6l2.7 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17.8 6.5 19.7l1.1-6.2L3.1 9.1l6.2-.9L12 2.6z"
            [attr.fill]="filled ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
        </svg>
      }
    </span>
  `,
  styleUrl: './star-rating.css',
})
export class StarRatingComponent {
  readonly rating = input(0);

  readonly stars = computed(() => {
    const filled = this.filledCount();
    return Array.from({ length: 5 }, (_, index) => index < filled);
  });

  readonly label = computed(() => {
    const filled = this.filledCount();
    return filled === 0 ? 'No ratings yet' : `${filled} out of 5 stars`;
  });

  private filledCount(): number {
    const value = Number(this.rating());
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }
    return Math.min(5, Math.round(value));
  }
}
