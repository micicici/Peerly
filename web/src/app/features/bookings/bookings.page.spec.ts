import { TestBed } from '@angular/core/testing';
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
  };
}

async function render(startAt: string): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [BookingsPage],
    providers: [
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

  it('does not print the join URL when the window is open', async () => {
    const el = await render(new Date(Date.now() + 5 * 60 * 1000).toISOString());
    const link = el.querySelector('a');
    expect(el.textContent).not.toContain(JOIN_URL);
    expect(el.textContent).not.toContain('Join URL');
    expect(link?.textContent?.trim()).toBe('Join');
    expect(link?.getAttribute('href')).toBe(JOIN_URL);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener');
  });

  it('hides Join when the window is closed', async () => {
    const el = await render(new Date(Date.now() + 30 * 60 * 1000).toISOString());
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).not.toContain(JOIN_URL);
    expect(el.textContent).not.toContain('Join URL');
  });
});
