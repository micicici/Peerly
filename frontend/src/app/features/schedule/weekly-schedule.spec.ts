import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Slot } from '../slots/slots.actions';
import { WeeklyScheduleComponent } from './weekly-schedule';

function futureOpenSlot(): { slot: Slot; advanceWeek: boolean } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    for (let hour = 0; hour <= 23; hour++) {
      const local = new Date(monday);
      local.setDate(monday.getDate() + i);
      local.setHours(hour, 0, 0, 0);
      if (local.getTime() > Date.now() + 60_000) {
        return { slot: toSlot(local), advanceWeek: false };
      }
    }
  }

  const next = new Date(monday);
  next.setDate(monday.getDate() + 7);
  next.setHours(10, 0, 0, 0);
  return { slot: toSlot(next), advanceWeek: true };
}

function toSlot(start: Date): Slot {
  return {
    id: 'slot-1',
    offeringId: null,
    teacherId: 'teacher-1',
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    status: 'open',
  };
}

describe('WeeklyScheduleComponent booking', () => {
  let fixture: ComponentFixture<WeeklyScheduleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyScheduleComponent],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('changes Available to Booked and removes Book as soon as Book is clicked', () => {
    const { slot, advanceWeek } = futureOpenSlot();
    fixture = TestBed.createComponent(WeeklyScheduleComponent);
    fixture.componentRef.setInput('mode', 'book');
    fixture.componentRef.setInput('slots', [slot]);
    fixture.componentRef.setInput('subjectLabel', 'Piano');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    if (advanceWeek) {
      const next = Array.from(host.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Next'),
      );
      next?.click();
      fixture.detectChanges();
    }

    const available = Array.from(host.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Available'),
    );
    expect(available).toBeTruthy();
    available?.click();
    fixture.detectChanges();

    const book = Array.from(host.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'BOOK',
    );
    expect(book).toBeTruthy();
    book?.click();
    fixture.detectChanges();

    const text = host.textContent ?? '';
    expect(text).toContain('Booked');
    expect(text).not.toContain('Available');
    expect(
      Array.from(host.querySelectorAll('button')).some(
        (btn) => btn.textContent?.trim() === 'BOOK',
      ),
    ).toBeFalse();
  });

  it('keeps a future empty hour clickable once the teacher has an offering', () => {
    const { slot, advanceWeek } = futureOpenSlot();
    const future = new Date(slot.startAt);
    fixture = TestBed.createComponent(WeeklyScheduleComponent);
    fixture.componentRef.setInput('mode', 'teach');
    fixture.componentRef.setInput('slots', []);
    fixture.componentRef.setInput('canOpenSlots', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    if (advanceWeek) {
      const next = Array.from(host.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Next'),
      );
      next?.click();
      fixture.detectChanges();
    }

    const match = Array.from(host.querySelectorAll('button.block')).find((btn) => {
      const row = btn.closest('tr');
      const hour = row?.querySelector('th')?.textContent ?? '';
      const index = row ? Array.from(row.children).indexOf(btn.parentElement!) : -1;
      const day = host.querySelectorAll('thead th')[index]?.textContent ?? '';
      return (
        hour.startsWith(String(future.getHours()).padStart(2, '0')) &&
        day.includes(String(future.getDate()))
      );
    }) as HTMLButtonElement | undefined;

    expect(match).toBeTruthy();
    expect(match?.disabled).toBeFalse();
    expect(match?.classList.contains('disabled')).toBeFalse();
  });

  it('locks empty hours while the teacher has no offerings', () => {
    fixture = TestBed.createComponent(WeeklyScheduleComponent);
    fixture.componentRef.setInput('mode', 'teach');
    fixture.componentRef.setInput('slots', []);
    fixture.componentRef.setInput('canOpenSlots', false);
    fixture.detectChanges();

    const blocks = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button.block'),
    ) as HTMLButtonElement[];
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((btn) => btn.disabled && btn.classList.contains('disabled'))).toBeTrue();
  });

  it('lists every hour from 00:00 through 23:00', () => {
    fixture = TestBed.createComponent(WeeklyScheduleComponent);
    fixture.componentRef.setInput('mode', 'teach');
    fixture.componentRef.setInput('slots', []);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('00:00');
    expect(text).toContain('08:00');
    expect(text).toContain('23:00');
    expect(text).not.toContain('24:00');
  });
});
