import { AppError } from '../common/app-error';

export function normalizeSpokenLanguages(values: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of values) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) {
      continue;
    }
    if (name.length > 40 || name.includes(',')) {
      throw new AppError(
        'FORBIDDEN',
        'Enter each spoken language without commas',
        400,
      );
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  if (names.length === 0) {
    throw new AppError('FORBIDDEN', 'Add at least one spoken language', 400);
  }
  return names;
}
