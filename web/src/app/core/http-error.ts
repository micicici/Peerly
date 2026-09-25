import { HttpErrorResponse } from '@angular/common/http';
import { ErrorCodes, messageForErrorCode } from './error-codes';

function parseErrorBody(
  raw: unknown,
): { code?: unknown; message?: unknown } | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as { code?: unknown; message?: unknown };
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as { code?: unknown; message?: unknown };
  }
  return null;
}

export function failureOf(err: unknown): { errorCode: string; message: string } {
  if (err instanceof HttpErrorResponse) {
    const body = parseErrorBody(err.error);
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
