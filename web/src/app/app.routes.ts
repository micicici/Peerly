import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { offeringGuard } from './core/offering.guard';
import { LoginPage } from './features/auth/login.page';
import { RegisterPage } from './features/auth/register.page';
import { OfferingDetailPage } from './features/catalog/offering-detail.page';
import { SubjectsPage } from './features/catalog/subjects.page';
import { OnboardingPage } from './features/offerings/onboarding.page';
import { TeachOfferingsPage } from './features/offerings/teach-offerings.page';
import { PlaceholderPage } from './features/shell/placeholder.page';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
  {
    path: 'onboarding',
    component: OnboardingPage,
    canActivate: [authGuard],
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard, offeringGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: PlaceholderPage, data: { title: 'Home' } },
      { path: 'subjects', component: SubjectsPage },
      { path: 'subjects/:id', component: OfferingDetailPage },
      { path: 'teach', component: TeachOfferingsPage },
      {
        path: 'bookings',
        component: PlaceholderPage,
        data: { title: 'Bookings' },
      },
      {
        path: 'profile',
        component: PlaceholderPage,
        data: { title: 'Profile' },
      },
    ],
  },
];
