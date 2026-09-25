import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { logout } from '../auth/auth.actions';
import { selectBalance } from '../ledger/ledger.selectors';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly store = inject(Store);
  readonly balance = this.store.selectSignal(selectBalance);

  logout(): void {
    this.store.dispatch(logout());
  }
}
