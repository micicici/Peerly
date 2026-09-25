import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { offeringGuard } from './core/offering.guard';
import { LoginPage } from './features/auth/login.page';
import { RegisterPage } from './features/auth/register.page';
import { BookingsPage } from './features/bookings/bookings.page';
import { OfferingDetailPage } from './features/catalog/offering-detail.page';
import { SubjectsPage } from './features/catalog/subjects.page';
import { HomePage } from './features/home/home.page';
import { OnboardingPage } from './features/offerings/onboarding.page';
import { TeachOfferingsPage } from './features/offerings/teach-offerings.page';
import { ProfilePage } from './features/profile/profile.page';
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
      { path: 'home', component: HomePage },
      { path: 'subjects', component: SubjectsPage },
      { path: 'subjects/:id', component: OfferingDetailPage },
      { path: 'teach', component: TeachOfferingsPage },
      { path: 'bookings', component: BookingsPage },
      { path: 'profile', component: ProfilePage },
    ],
  },
];
