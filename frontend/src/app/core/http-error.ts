import { HttpErrorResponse } from '@angular/common/http';
import { ErrorCodes, messageForErrorCode } from './error-codes';

function parseErrorBody(
  raw: unknown,
): { code?: unknown; message?: unknown; errors?: unknown } | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as {
        code?: unknown;
        message?: unknown;
        errors?: unknown;
      };
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as { code?: unknown; message?: unknown; errors?: unknown };
  }
  return null;
}

function textList(value: unknown): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => textList(item));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const constraints = record['constraints'];
    if (
      constraints &&
      typeof constraints === 'object' &&
      !Array.isArray(constraints)
    ) {
      return textList(Object.values(constraints as Record<string, unknown>));
    }
    if ('message' in record) {
      return textList(record['message']);
    }
  }
  return [];
}

function validationMessage(
  body: { message?: unknown; errors?: unknown } | null,
): string | null {
  if (!body) {
    return null;
  }
  const parts = [...new Set([...textList(body.message), ...textList(body.errors)])];
  return parts.length > 0 ? parts.join(', ') : null;
}

export function failureOf(err: unknown): { errorCode: string; message: string } {
  if (err instanceof HttpErrorResponse) {
    const body = parseErrorBody(err.error);
    const errorCode =
      body && typeof body.code === 'string' && body.code.length > 0
        ? body.code
        : ErrorCodes.INTERNAL;
    const message = validationMessage(body) ?? messageForErrorCode(errorCode);
    return { errorCode, message };
  }
  return {
    errorCode: ErrorCodes.INTERNAL,
    message: messageForErrorCode(ErrorCodes.INTERNAL),
  };
}
