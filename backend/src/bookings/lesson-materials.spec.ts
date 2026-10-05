import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AppError } from '../common/app-error';
import {
  contentDisposition,
  isAllowedLessonFile,
  isSafeStoredName,
  materialFilePath,
  sanitizeOriginalName,
} from './lesson-materials';

describe('lesson materials', () => {
  it('accepts notes and homework and rejects executables', () => {
    expect(isAllowedLessonFile('homework.pdf', 'application/pdf')).toBe(true);
    expect(isAllowedLessonFile('notes.txt', 'text/plain')).toBe(true);
    expect(isAllowedLessonFile('slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(true);
    expect(isAllowedLessonFile('virus.exe', 'application/octet-stream')).toBe(false);
    expect(isAllowedLessonFile('page.html', 'text/html')).toBe(false);
    expect(isAllowedLessonFile('homework.pdf', 'text/html')).toBe(false);
  });

  it('keeps downloads inside the booking directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'materials-'));
    const bookingId = '11111111-1111-4111-8111-111111111111';
    const stored = '22222222-2222-4222-8222-222222222222.pdf';
    expect(isSafeStoredName(stored)).toBe(true);
    expect(isSafeStoredName('../secret.pdf')).toBe(false);
    expect(materialFilePath(root, bookingId, stored)).toBe(
      join(root, bookingId, stored),
    );
    expect(() => materialFilePath(root, bookingId, '../secret.pdf')).toThrow(
      AppError,
    );
  });

  it('builds a safe download header', () => {
    expect(sanitizeOriginalName('folder/notes.pdf')).toBe('notes.pdf');
    expect(contentDisposition('week 1.pdf')).toContain('filename="week 1.pdf"');
    expect(contentDisposition('bad\r\nname.pdf')).not.toContain('\r');
  });
});
