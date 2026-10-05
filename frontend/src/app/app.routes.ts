import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard } from './core/admin.guard';
import { offeringGuard } from './core/offering.guard';
import { LoginPage } from './features/auth/login.page';
import { RegisterPage } from './features/auth/register.page';
import { AdminPage } from './features/admin/admin.page';
import { BookingsPage } from './features/bookings/bookings.page';
import { ClassroomPage } from './features/classroom/classroom.page';
import { OfferingDetailPage } from './features/catalog/offering-detail.page';
import { SubjectsPage } from './features/catalog/subjects.page';
import { HomePage } from './features/home/home.page';
import { InboxPage } from './features/inbox/inbox.page';
import { OnboardingPage } from './features/offerings/onboarding.page';
import { TeachOfferingsPage } from './features/offerings/teach-offerings.page';
import { ProfilePage } from './features/profile/profile.page';
import { TeacherProfilePage } from './features/profile/teacher-profile.page';
import { Shell } from './features/shell/shell';

export const routes: Routes = [
  {
    path: 'classroom/:bookingId',
    component: ClassroomPage,
    canActivate: [authGuard, offeringGuard],
  },
  {
    path: 'onboarding',
    component: OnboardingPage,
    canActivate: [authGuard],
  },
  {
    path: '',
    component: Shell,
    canActivate: [offeringGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: HomePage },
      { path: 'subjects', component: SubjectsPage },
      { path: 'subjects/:id', component: OfferingDetailPage },
      { path: 'teachers/:id', component: TeacherProfilePage },
      { path: 'login', component: LoginPage },
      { path: 'register', component: RegisterPage },
      {
        path: 'teach',
        component: TeachOfferingsPage,
        canActivate: [authGuard],
      },
      {
        path: 'bookings',
        component: BookingsPage,
        canActivate: [authGuard],
      },
      {
        path: 'inbox',
        component: InboxPage,
        canActivate: [authGuard],
      },
      {
        path: 'profile',
        component: ProfilePage,
        canActivate: [authGuard],
      },
      {
        path: 'admin',
        component: AdminPage,
        canActivate: [authGuard, adminGuard],
      },
    ],
  },
];
