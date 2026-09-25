import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { offeringGuard } from './core/offering.guard';
import { LoginPage } from './features/auth/login.page';
import { RegisterPage } from './features/auth/register.page';
import { PlaceholderPage } from './features/shell/placeholder.page';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'register', component: RegisterPage },
  {
    path: 'onboarding',
    component: PlaceholderPage,
    canActivate: [authGuard],
    data: { title: 'Onboarding' },
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard, offeringGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: PlaceholderPage, data: { title: 'Home' } },
      {
        path: 'subjects',
        component: PlaceholderPage,
        data: { title: 'Subjects' },
      },
      {
        path: 'subjects/:id',
        component: PlaceholderPage,
        data: { title: 'Subject' },
      },
      { path: 'teach', component: PlaceholderPage, data: { title: 'Teach' } },
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
