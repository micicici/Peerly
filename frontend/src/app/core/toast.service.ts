import { Injectable, signal } from '@angular/core';

/** Short-lived error and status text shown in the shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  readonly code = signal<string | null>(null);

  show(message: string, code?: string | null): void {
    this.message.set(message);
    this.code.set(code ?? null);
  }

  clear(): void {
    this.message.set(null);
    this.code.set(null);
  }

  /** Hide a prompt once the action it asked for has been completed. */
  clearResolved(code: string): void {
    const message = this.message()?.toLowerCase() ?? '';
    const offeringPrompt =
      code === 'OFFERING_REQUIRED' && message.includes('publish an offering');
    if (this.code() === code || offeringPrompt) {
      this.clear();
    }
  }
}
