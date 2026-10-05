import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, take } from 'rxjs';
import { selectNeedsOffering } from '../features/auth/auth.selectors';

/** Sends users who still need a first offering to onboarding. */
export const offeringGuard: CanActivateFn = () => {
  const store = inject(Store);
  const router = inject(Router);
  return store.select(selectNeedsOffering).pipe(
    take(1),
    map((needsOffering) =>
      needsOffering ? router.createUrlTree(['/onboarding']) : true,
    ),
  );
};
