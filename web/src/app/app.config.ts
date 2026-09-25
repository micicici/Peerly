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
import { authInterceptor, P2P_TOKEN_KEY } from './core/auth.interceptor';
import { CatalogEffects } from './features/catalog/catalog.effects';
import { loadMe } from './features/auth/auth.actions';
import { AuthEffects } from './features/auth/auth.effects';
import { selectAuthState } from './features/auth/auth.selectors';
import { OfferingsEffects } from './features/offerings/offerings.effects';
import { reducers } from './store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideStore(reducers),
    provideEffects(AuthEffects, OfferingsEffects, CatalogEffects),
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
