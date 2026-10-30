import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore, Store } from '@ngrx/store';
import { filter, firstValueFrom, take } from 'rxjs';
import { routes } from './app.routes';
import { apiErrorInterceptor } from './core/api-error.interceptor';
import { authInterceptor, P2P_TOKEN_KEY } from './core/auth.interceptor';
import { BookingsEffects } from './features/bookings/bookings.effects';
import { CatalogEffects } from './features/catalog/catalog.effects';
import { loadMe } from './features/auth/auth.actions';
import { AuthEffects } from './features/auth/auth.effects';
import { selectAuthState } from './features/auth/auth.selectors';
import { LedgerEffects } from './features/ledger/ledger.effects';
import { OfferingsEffects } from './features/offerings/offerings.effects';
import { SlotsEffects } from './features/slots/slots.effects';
import { reducers } from './store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, apiErrorInterceptor])),
    provideStore(reducers),
    provideEffects(
      AuthEffects,
      OfferingsEffects,
      CatalogEffects,
      SlotsEffects,
      BookingsEffects,
      LedgerEffects,
    ),
    provideAppInitializer(() => {
      const store = inject(Store);
      if (!localStorage.getItem(P2P_TOKEN_KEY)) {
        return;
      }
      store.dispatch(loadMe());
      return firstValueFrom(
        store.select(selectAuthState).pipe(
          filter((auth) => auth.status !== 'loading'),
          take(1),
        ),
      );
    }),
  ],
};
