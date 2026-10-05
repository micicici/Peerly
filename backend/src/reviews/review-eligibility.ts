export const REVIEW_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export type ReviewDecisionCode =
  | 'OK'
  | 'FORBIDDEN'
  | 'CLASS_REQUIRED'
  | 'REVIEW_TOO_SOON';

export interface ReviewDecision {
  canReview: boolean;
  code: ReviewDecisionCode;
  reason: string | null;
}

export function reviewEligibility(input: {
  isSelf: boolean;
  hasCompletedClass: boolean;
  lastReviewAt: Date | null;
  now: Date;
}): ReviewDecision {
  if (input.isSelf) {
    return {
      canReview: false,
      code: 'FORBIDDEN',
      reason: 'You cannot review yourself',
    };
  }
  if (!input.hasCompletedClass) {
    return {
      canReview: false,
      code: 'CLASS_REQUIRED',
      reason:
        'You can leave a review after you complete a class with this teacher.',
    };
  }
  if (
    input.lastReviewAt &&
    input.now.getTime() - input.lastReviewAt.getTime() < REVIEW_INTERVAL_MS
  ) {
    return {
      canReview: false,
      code: 'REVIEW_TOO_SOON',
      reason: 'You can review this teacher once a month.',
    };
  }
  return { canReview: true, code: 'OK', reason: null };
}
