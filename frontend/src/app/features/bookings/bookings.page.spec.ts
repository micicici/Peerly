import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { Booking } from './bookings.actions';
import { BookingsPage } from './bookings.page';

const JOIN_URL = 'https://meet.jit.si/secret-room';

function booking(startAt: string): Booking {
  return {
    id: 'b1',
    slotId: 's1',
    learnerId: 'l1',
    teacherId: 't1',
    offeringId: 'o1',
    joinUrl: JOIN_URL,
    status: 'confirmed',
    createdAt: '2026-09-25T00:00:00.000Z',
    startAt,
    offeringTitle: 'Guitar',
    subjectName: 'Music',
    teacherName: 'Ada',
    learnerName: 'A',
    materials: [],
  };
}

async function render(startAt: string): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [BookingsPage, HttpClientTestingModule],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          auth: {
            token: 't',
            me: {
              id: 'l1',
              email: 'a@b.c',
              name: 'A',
              bio: null,
              avatarUrl: null,
              gender: null,
              yearOfBirth: null,
              spokenLanguages: [],
              timezone: 'UTC',
              balance: 3,
              offeringCount: 1,
            },
            status: 'idle',
            errorCode: null,
          },
          bookings: {
            ids: ['b1'],
            entities: { b1: booking(startAt) },
            status: 'idle',
            errorCode: null,
          },
        },
      }),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(BookingsPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BookingsPage join link', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('opens the classroom when the join window is open', async () => {
    const el = await render(new Date(Date.now() + 5 * 60 * 1000).toISOString());
    const button = el.querySelector('button.join') as HTMLButtonElement | null;
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    expect(el.textContent).not.toContain(JOIN_URL);
    expect(el.textContent).not.toContain('Join URL');
    expect(button?.textContent?.trim()).toBe('Join Class');
    expect(button?.disabled).toBeFalse();
    button?.click();
    expect(router.navigate).toHaveBeenCalledWith(['/classroom', 'b1']);
  });

  it('hides Join Class until 10 minutes before start', async () => {
    const el = await render(new Date(Date.now() + 30 * 60 * 1000).toISOString());
    expect(el.querySelector('button.join')).toBeNull();
    expect(el.textContent).toContain('Available 10m before class');
    expect(el.textContent).not.toContain('Join Class');
    expect(el.textContent).not.toContain(JOIN_URL);
    expect(el.textContent).not.toContain('Join URL');
  });

  it('keeps Join Class visible for 10 minutes after the class ends', async () => {
    const el = await render(new Date(Date.now() - 65 * 60 * 1000).toISOString());
    const button = el.querySelector('button.join') as HTMLButtonElement | null;
    expect(button?.textContent?.trim()).toBe('Join Class');
    expect(button?.disabled).toBeFalse();
  });

  it('hides Join Class after the 10 minute grace', async () => {
    const el = await render(new Date(Date.now() - 80 * 60 * 1000).toISOString());
    expect(el.querySelector('button.join')).toBeNull();
    expect(el.textContent).toContain('Class ended');
  });
});
