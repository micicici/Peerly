import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';

export interface AdminSubject {
  id: string;
  name: string;
  offeringCount: number;
  createdAt: string;
}

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  templateUrl: './admin.page.html',
  styleUrl: './admin.page.css',
})
export class AdminPage {
  private readonly api = inject(ApiService);
  readonly subjects = signal<AdminSubject[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly draftName = signal('');
  readonly confirmingId = signal<string | null>(null);
  readonly mergeInto = signal<Record<string, string>>({});
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.get<AdminSubject[]>('/admin/subjects').subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.errorMessage.set(null);
      },
      error: (err: unknown) => this.errorMessage.set(failureOf(err).message),
    });
  }

  others(id: string): AdminSubject[] {
    return this.subjects().filter((subject) => subject.id !== id);
  }

  startEdit(subject: AdminSubject): void {
    this.confirmingId.set(null);
    this.editingId.set(subject.id);
    this.draftName.set(subject.name);
  }

  saveName(id: string): void {
    const name = this.draftName().trim();
    if (!name) {
      this.errorMessage.set('Enter a subject name');
      return;
    }
    this.api.patch<AdminSubject>(`/admin/subjects/${id}`, { name }).subscribe({
      next: () => {
        this.editingId.set(null);
        this.reload();
      },
      error: (err: unknown) => this.errorMessage.set(failureOf(err).message),
    });
  }

  chooseMerge(id: string, intoId: string): void {
    this.mergeInto.update((current) => ({ ...current, [id]: intoId }));
  }

  merge(id: string): void {
    const intoId = this.mergeInto()[id];
    if (!intoId) {
      this.errorMessage.set('Choose a subject to merge into');
      return;
    }
    this.api
      .post<AdminSubject>(`/admin/subjects/${id}/merge`, { intoId })
      .subscribe({
        next: () => this.reload(),
        error: (err: unknown) => this.errorMessage.set(failureOf(err).message),
      });
  }

  askDelete(id: string): void {
    this.editingId.set(null);
    this.confirmingId.set(id);
  }

  confirmDelete(id: string): void {
    this.api.delete(`/admin/subjects/${id}`).subscribe({
      next: () => {
        this.confirmingId.set(null);
        this.reload();
      },
      error: (err: unknown) => this.errorMessage.set(failureOf(err).message),
    });
  }
}
