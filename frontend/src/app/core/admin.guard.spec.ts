/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, isObservable } from 'rxjs';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function allow(role: 'USER' | 'ADMIN' | null): Promise<boolean | UrlTree> {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            auth: {
              token: role ? 't' : null,
              me: role
                ? {
                    id: '1',
                    email: 'a@b.c',
                    name: 'A',
                    bio: null,
                    avatarUrl: null,
                    gender: null,
                    yearOfBirth: null,
                    spokenLanguages: [],
                    timezone: 'UTC',
                    role,
                    balance: 0,
                    offeringCount: 0,
                  }
                : null,
              status: 'idle',
              errorCode: null,
            },
          },
        }),
      ],
    }).compileComponents();
    const result = TestBed.runInInjectionContext(() =>
      adminGuard({} as never, { url: '/admin' } as never),
    );
    const value = isObservable(result) ? await firstValueFrom(result) : result;
    return value as boolean | UrlTree;
  }

  it('allows an admin', async () => {
    expect(await allow('ADMIN')).toBeTrue();
  });

  it('sends everyone else home', async () => {
    const router = () => TestBed.inject(Router);
    const user = await allow('USER');
    expect(user).toEqual(router().createUrlTree(['/home']));
    TestBed.resetTestingModule();
    const guest = await allow(null);
    expect(guest).toEqual(TestBed.inject(Router).createUrlTree(['/home']));
  });
});
