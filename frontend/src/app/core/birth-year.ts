import { AbstractControl, ValidationErrors } from '@angular/forms';

export const BIRTH_YEAR_PLACEHOLDER = '2001';
export const MIN_BIRTH_YEAR = 1900;

export function maxBirthYear(now = new Date()): number {
  return now.getFullYear();
}

export function birthYearValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) {
    return null;
  }
  if (!/^\d{4}$/.test(raw)) {
    return { year: true };
  }
  const year = Number(raw);
  if (year < MIN_BIRTH_YEAR || year > maxBirthYear()) {
    return { year: true };
  }
  return null;
}

export function parseBirthYear(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}$/.test(raw)) {
    return null;
  }
  const year = Number(raw);
  if (year < MIN_BIRTH_YEAR || year > maxBirthYear()) {
    return null;
  }
  return year;
}
