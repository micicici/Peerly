import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { register } from './auth.actions';
import { selectAuthState } from './auth.selectors';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrl: './auth.page.css',
})
export class RegisterPage {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  readonly auth = this.store.selectSignal(selectAuthState);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    timezone: [
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      Validators.required,
    ],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password, name, timezone } = this.form.getRawValue();
    this.store.dispatch(register({ email, password, name, timezone }));
  }
}
