import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs';
import { selectIsAuthed } from '../features/auth/auth.selectors';

/** Redirects anonymous users to login and keeps the requested URL. */
export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(Store);
  const router = inject(Router);
  return store.select(selectIsAuthed).pipe(
    take(1),
    map(
      (authed) =>
        authed ||
        router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        }),
    ),
  );
};
