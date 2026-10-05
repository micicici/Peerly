import { reviewEligibility } from './review-eligibility';

const now = new Date('2026-09-26T12:00:00.000Z');

describe('reviewEligibility', () => {
  it('blocks a review until a class with that teacher is completed', () => {
    expect(
      reviewEligibility({
        isSelf: false,
        hasCompletedClass: false,
        lastReviewAt: null,
        now,
      }),
    ).toEqual({
      canReview: false,
      code: 'CLASS_REQUIRED',
      reason:
        'You can leave a review after you complete a class with this teacher.',
    });
  });

  it('allows one review and blocks another within a month', () => {
    const recent = new Date('2026-09-10T12:00:00.000Z');
    expect(
      reviewEligibility({
        isSelf: false,
        hasCompletedClass: true,
        lastReviewAt: recent,
        now,
      }),
    ).toEqual({
      canReview: false,
      code: 'REVIEW_TOO_SOON',
      reason: 'You can review this teacher once a month.',
    });
  });

  it('allows a review a month after the previous one when a class was completed', () => {
    const older = new Date('2026-08-01T12:00:00.000Z');
    expect(
      reviewEligibility({
        isSelf: false,
        hasCompletedClass: true,
        lastReviewAt: older,
        now,
      }).canReview,
    ).toBe(true);
  });
});
