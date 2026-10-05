import { Component, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { logout } from '../auth/auth.actions';
import { selectIsAdmin, selectIsAuthed, selectMe } from '../auth/auth.selectors';
import { selectBalance } from '../ledger/ledger.selectors';
import { ReviewPromptService } from '../reviews/review-prompt.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly store = inject(Store);
  readonly prompt = inject(ReviewPromptService);
  readonly balance = this.store.selectSignal(selectBalance);
  readonly me = this.store.selectSignal(selectMe);
  readonly authed = this.store.selectSignal(selectIsAuthed);
  readonly isAdmin = this.store.selectSignal(selectIsAdmin);

  constructor() {
    toObservable(this.authed)
      .pipe(takeUntilDestroyed())
      .subscribe((authed) => {
        if (authed) {
          this.prompt.refresh();
        } else {
          this.prompt.clear();
        }
      });
  }

  logout(): void {
    this.store.dispatch(logout());
  }
}
