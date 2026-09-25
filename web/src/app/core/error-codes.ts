export const ErrorCodes = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  OFFERING_REQUIRED: 'OFFERING_REQUIRED',
  SLOT_GONE: 'SLOT_GONE',
  SLOT_IN_PAST: 'SLOT_IN_PAST',
  SLOT_OVERLAP: 'SLOT_OVERLAP',
  SLOT_INVALID: 'SLOT_INVALID',
  INSUFFICIENT_HOURS: 'INSUFFICIENT_HOURS',
  SELF_BOOK: 'SELF_BOOK',
  FORBIDDEN: 'FORBIDDEN',
  CANCEL_NOT_ALLOWED: 'CANCEL_NOT_ALLOWED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INTERNAL: 'INTERNAL',
} as const;

const messages: Record<string, string> = {
  [ErrorCodes.UNAUTHENTICATED]: 'Email or password is incorrect.',
  [ErrorCodes.EMAIL_TAKEN]: 'That email is already registered.',
  [ErrorCodes.OFFERING_REQUIRED]: 'Publish an offering before continuing.',
  [ErrorCodes.SLOT_GONE]: 'That hour was just taken.',
  [ErrorCodes.SLOT_IN_PAST]: 'That hour is in the past.',
  [ErrorCodes.SLOT_OVERLAP]: 'That hour overlaps another slot.',
  [ErrorCodes.SLOT_INVALID]: 'Start must be on the UTC hour.',
  [ErrorCodes.INSUFFICIENT_HOURS]:
    'Not enough hours. Teach to earn more.',
  [ErrorCodes.SELF_BOOK]: 'You cannot book your own hour.',
  [ErrorCodes.CANCEL_NOT_ALLOWED]: 'This booking can no longer be cancelled.',
  [ErrorCodes.FORBIDDEN]: 'You cannot do that.',
  [ErrorCodes.INTERNAL]: 'Try again.',
};

export function messageForErrorCode(code: string): string {
  return messages[code] ?? code;
}
