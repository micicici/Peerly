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
      />
      <datalist [id]="listId">
        @for (subject of subjects(); track subject.id) {
          <option [value]="subject.name"></option>
        }
      </datalist>
    </label>
    <p class="meta">
      Choose an existing subject or type a new one. New subjects are saved for later.
    </p>
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
}
