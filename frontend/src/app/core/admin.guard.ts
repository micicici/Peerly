import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';
import { selectAuthState } from '../features/auth/auth.selectors';

/** Allows the admin area only for accounts with the ADMIN role. */
export const adminGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  return store.select(selectAuthState).pipe(
    filter(
      (auth) => auth.me !== null || auth.status === 'error' || auth.token === null,
    ),
    take(1),
    map((auth) =>
      auth.me?.role === 'ADMIN' ? true : router.createUrlTree(['/home']),
    ),
  );
};
