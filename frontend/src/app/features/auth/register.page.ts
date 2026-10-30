import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastService } from '../../core/toast.service';
import { BIRTH_YEAR_PLACEHOLDER, birthYearValidator, parseBirthYear } from '../../core/birth-year';
import { parseLanguages } from '../../core/languages';
import { clearAuthError, register } from './auth.actions';
import { selectAuthState } from './auth.selectors';

function hasLanguage(control: AbstractControl): ValidationErrors | null {
  return parseLanguages(String(control.value ?? '')).length > 0
    ? null
    : { required: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrl: './auth.page.css',
})
export class RegisterPage {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = this.store.selectSignal(selectAuthState);
  readonly birthYearPlaceholder = BIRTH_YEAR_PLACEHOLDER;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    bio: ['', [Validators.required, Validators.minLength(10)]],
    timezone: [
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      Validators.required,
    ],
    gender: this.fb.nonNullable.control<'' | 'male' | 'female'>(
      '',
      Validators.required,
    ),
    yearOfBirth: [
      BIRTH_YEAR_PLACEHOLDER,
      [Validators.required, birthYearValidator],
    ],
    spokenLanguages: ['', hasLanguage],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.auth().errorMessage) {
        this.toast.clear();
        this.store.dispatch(clearAuthError());
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const {
      email,
      password,
      name,
      timezone,
      bio,
      gender,
      yearOfBirth,
      spokenLanguages,
    } = this.form.getRawValue();
    const birthYear = parseBirthYear(yearOfBirth);
    if (!gender || birthYear == null) {
      return;
    }
    this.store.dispatch(
      register({
        email,
        password,
        name,
        timezone,
        bio,
        gender,
        yearOfBirth: birthYear,
        spokenLanguages: parseLanguages(spokenLanguages),
      }),
    );
  }

  fieldError(
    controlName:
      | 'name'
      | 'email'
      | 'password'
      | 'bio'
      | 'timezone'
      | 'gender'
      | 'yearOfBirth'
      | 'spokenLanguages',
  ): string | null {
    const control = this.form.controls[controlName];
    if (control.valid || !control.touched) {
      return null;
    }
    if (controlName === 'yearOfBirth' && control.hasError('year')) {
      return 'Enter a valid year of birth.';
    }
    if (control.hasError('required')) {
      const labels = {
        name: 'Name',
        email: 'Email',
        password: 'Password',
        bio: 'Bio',
        timezone: 'Timezone',
        gender: 'Gender',
        yearOfBirth: 'Year of birth',
        spokenLanguages: 'Spoken languages',
      } as const;
      return `${labels[controlName]} is required.`;
    }
    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('minlength')) {
      return 'Bio must be at least 10 characters.';
    }
    return null;
  }
}
