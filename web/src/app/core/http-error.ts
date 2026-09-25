import { HttpErrorResponse } from '@angular/common/http';
import { ErrorCodes, messageForErrorCode } from './error-codes';

export function failureOf(err: unknown): { errorCode: string; message: string } {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { code?: unknown; message?: unknown } | null;
    const errorCode =
      body && typeof body.code === 'string' && body.code.length > 0
        ? body.code
        : ErrorCodes.INTERNAL;
    const message =
      body && typeof body.message === 'string' && body.message.length > 0
        ? body.message
        : messageForErrorCode(errorCode);
    return { errorCode, message };
  }
  return {
    errorCode: ErrorCodes.INTERNAL,
    message: messageForErrorCode(ErrorCodes.INTERNAL),
  };
}
