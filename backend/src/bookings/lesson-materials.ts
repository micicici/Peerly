import { extname, isAbsolute, join, relative, resolve, basename } from 'path';
import { AppError } from '../common/app-error';

export const LESSON_MATERIALS_ROOT = join(
  process.cwd(),
  'storage',
  'lesson-materials',
);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

export function lessonFileExtension(originalName: string): string | null {
  const ext = extname(originalName).toLowerCase();
  return ext in ALLOWED_TYPES ? ext : null;
}

export function isAllowedLessonFile(originalName: string, mimeType: string): boolean {
  const ext = lessonFileExtension(originalName);
  if (!ext) {
    return false;
  }
  return ALLOWED_TYPES[ext].includes(mimeType);
}

export function isSafeStoredName(storedName: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|txt|doc|docx|ppt|pptx|png|jpe?g|zip)$/i.test(
      storedName,
    ) && !storedName.includes('/') && !storedName.includes('\\')
  );
}

export function sanitizeOriginalName(name: string): string {
  const base = basename(name).replace(/[\r\n"]/g, '').trim();
  return (base || 'material').slice(0, 180);
}

export function contentDisposition(name: string): string {
  const safe = sanitizeOriginalName(name);
  const ascii = safe.replace(/[^\w.\- ()]/g, '_').slice(0, 180) || 'material';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export function materialFilePath(
  root: string,
  bookingId: string,
  storedName: string,
): string {
  if (!UUID.test(bookingId) || !isSafeStoredName(storedName)) {
    throw new AppError('NOT_FOUND', 'Material not found', 404);
  }
  const rootResolved = resolve(root);
  const full = resolve(rootResolved, bookingId, storedName);
  const rel = relative(rootResolved, full);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new AppError('NOT_FOUND', 'Material not found', 404);
  }
  return full;
}
