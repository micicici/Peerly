import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-subject-input',
  imports: [ReactiveFormsModule],
  template: `
    <label>
      Subject
      <input
        type="text"
        [formControl]="control()"
        [attr.list]="listId"
        placeholder="Cooking, IT, Math"
        autocomplete="off"
        (blur)="control().markAsTouched()"
      />
      <datalist [id]="listId">
        @for (subject of subjects(); track subject.id) {
          <option [value]="subject.name"></option>
        }
      </datalist>
      @if (requiredError()) {
        <span class="form-error" role="alert">Subject is required</span>
      }
    </label>
    <p class="meta">
      Choose an existing subject or type a new one. New subjects are saved for later.
    </p>
  `,
  styles: `
    .form-error {
      margin: 0.35rem 0 0;
      color: #9f1239;
    }
  `,
})
export class SubjectInputComponent implements OnInit {
  readonly control = input.required<FormControl<string>>();
  readonly listId = `subjects-${Math.random().toString(36).slice(2, 8)}`;
  readonly subjects = signal<{ id: string; name: string }[]>([]);
  private readonly api = inject(ApiService);

  ngOnInit(): void {
    this.api.get<{ id: string; name: string }[]>('/subjects').subscribe({
      next: (rows) => this.subjects.set(rows),
      error: () => this.subjects.set([]),
    });
  }

  requiredError(): boolean {
    const control = this.control();
    return control.hasError('required') && (control.touched || control.dirty);
  }
}
