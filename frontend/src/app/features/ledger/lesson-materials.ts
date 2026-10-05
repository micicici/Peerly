import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { failureOf } from '../../core/http-error';
import { ToastService } from '../../core/toast.service';

export interface LessonMaterialRef {
  id: string;
  originalName: string;
}

@Component({
  selector: 'app-lesson-materials',
  template: `
    @if (canAttach) {
      <label class="attach">
        Attach Material
        <input
          type="file"
          [disabled]="uploading()"
          accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
          (change)="onFile($event)"
        />
      </label>
    }
    @for (file of materials; track file.id) {
      <button type="button" class="material-link" (click)="download(file)">
        Download Material
        <span class="file-name">{{ file.originalName }}</span>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 0.85rem;
      align-items: center;
    }
    :host:empty {
      display: none;
    }
    .attach {
      display: inline-block;
      background: transparent;
      color: #0f766e;
      border: 1px solid #0f766e;
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      cursor: pointer;
      font-weight: 650;
    }
    .attach input {
      display: none;
    }
    .material-link {
      background: transparent;
      color: #0f766e;
      border: 0;
      padding: 0.35rem 0;
      text-decoration: underline;
      font-weight: 650;
    }
    .file-name {
      margin-left: 0.35rem;
      font-weight: 450;
    }
  `,
})
export class LessonMaterials {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly uploading = signal(false);

  @Input({ required: true }) bookingId!: string;
  @Input() materials: LessonMaterialRef[] = [];
  @Input() canAttach = false;
  @Output() changed = new EventEmitter<void>();

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading()) {
      return;
    }
    const body = new FormData();
    body.append('file', file);
    this.uploading.set(true);
    this.api.postForm(`/bookings/${this.bookingId}/materials`, body).subscribe({
      next: () => {
        this.uploading.set(false);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.toast.show(failureOf(err).message);
      },
    });
  }

  download(file: LessonMaterialRef): void {
    this.api
      .getBlob(`/bookings/${this.bookingId}/materials/${file.id}`)
      .subscribe({
        next: (blob) => saveBlob(blob, file.originalName),
        error: (err: unknown) => this.toast.show(failureOf(err).message),
      });
  }
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
