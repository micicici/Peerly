import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { Slot } from '../slots/slots.actions';

export type ScheduleMode = 'teach' | 'book';

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

@Component({
  selector: 'app-weekly-schedule',
  imports: [CommonModule],
  template: `
    <div class="week-nav">
      <button type="button" class="ghost" (click)="shift(-1)">Previous</button>
      <strong>{{ rangeLabel() }}</strong>
      <button type="button" class="ghost" (click)="shift(1)">Next</button>
    </div>
    <div class="grid-wrap">
      <table class="week-grid">
        <thead>
          <tr>
            <th></th>
            @for (day of days(); track day.getTime()) {
              <th>{{ dayLabel(day) }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (hour of hours; track hour) {
            <tr>
              <th>{{ hourLabel(hour) }}</th>
              @for (day of days(); track day.getTime()) {
                @let cell = cellAt(day, hour);
                <td>
                  @if (mode() === 'teach') {
                    <button
                      type="button"
                      class="block"
                      [class.open]="!!cell.slot && cell.slot.status === 'open'"
                      [class.booked]="cell.slot?.status === 'booked'"
                      [class.disabled]="teachLocked(cell)"
                      [disabled]="teachLocked(cell)"
                      (click)="toggleTeach(day, hour, cell.slot)"
                    >
                      @if (cell.slot?.status === 'booked') {
                        Booked
                      } @else if (cell.slot?.status === 'open') {
                        Open
                      } @else {
                        —
                      }
                    </button>
                  } @else {
                    @if (bookable(cell); as slot) {
                    <button
                      type="button"
                      class="block open"
                      [class.selected]="selectedSlotId() === slot.id"
                      (click)="pick(slot)"
                    >
                      {{ selectedSlotId() === slot.id ? subjectLabel() : 'Available' }}
                    </button>
                    @if (selectedSlotId() === slot.id) {
                      <button type="button" class="book-btn" (click)="confirmBook()">
                        BOOK
                      </button>
                    }
                    } @else if (cell.slot && isBooked(cell.slot)) {
                    <span class="block booked">Booked</span>
                    } @else {
                    <span class="empty">—</span>
                    }
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './weekly-schedule.css',
  host: {
    '[class.fill]': 'fillViewport()',
  },
})
export class WeeklyScheduleComponent {
  readonly mode = input<ScheduleMode>('book');
  readonly slots = input<Slot[]>([]);
  /** Teach mode: future empty hours stay clickable while this is true. */
  readonly canOpenSlots = input(true);
  readonly subjectLabel = input('Book');
  readonly timezone = input('UTC');
  readonly fillViewport = input(false);
  readonly revertSlotId = input<string | null>(null);
  readonly revertNonce = input(0);
  readonly toggle = output<Date>();
  readonly close = output<string>();
  readonly selectSlot = output<Slot>();
  readonly book = output<Slot>();

  readonly hours = Array.from({ length: 24 }, (_, i) => i);
  readonly weekStart = signal(startOfWeek(new Date()));
  readonly selectedSlotId = signal<string | null>(null);
  readonly locallyBookedIds = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => {
      const nonce = this.revertNonce();
      const id = this.revertSlotId();
      if (!id || nonce === 0) {
        return;
      }
      this.locallyBookedIds.update((ids) => {
        if (!ids.has(id)) {
          return ids;
        }
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    });
  }

  readonly days = computed(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.weekStart());
      d.setDate(d.getDate() + i);
      return d;
    }),
  );

  readonly rangeLabel = computed(() => {
    const start = this.days()[0];
    const end = this.days()[6];
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  });

  shift(weeks: number): void {
    const next = new Date(this.weekStart());
    next.setDate(next.getDate() + weeks * 7);
    this.weekStart.set(startOfWeek(next));
    this.selectedSlotId.set(null);
  }

  dayLabel(day: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(day);
  }

  hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  cellAt(day: Date, hour: number): { slot?: Slot; past: boolean } {
    const local = new Date(day);
    local.setHours(hour, 0, 0, 0);
    const startMs = local.getTime();
    const slot = this.slots().find((s) => {
      const t = new Date(s.startAt).getTime();
      return Math.abs(t - startMs) < 60 * 1000;
    });
    return { slot, past: startMs <= Date.now() };
  }

  isBooked(slot: Slot): boolean {
    return slot.status === 'booked' || this.locallyBookedIds().has(slot.id);
  }

  teachLocked(cell: { slot?: Slot; past: boolean }): boolean {
    if (!this.canOpenSlots()) {
      return cell.slot?.status !== 'open';
    }
    return cell.past || cell.slot?.status === 'booked';
  }

  bookable(cell: { slot?: Slot; past: boolean }): Slot | null {
    if (
      cell.slot?.status === 'open' &&
      !cell.past &&
      !this.locallyBookedIds().has(cell.slot.id)
    ) {
      return cell.slot;
    }
    return null;
  }

  toggleTeach(day: Date, hour: number, slot?: Slot): void {
    if (slot?.status === 'open') {
      this.close.emit(slot.id);
      return;
    }
    if (slot) {
      return;
    }
    const local = new Date(day);
    local.setHours(hour, 0, 0, 0);
    this.toggle.emit(local);
  }

  pick(slot: Slot): void {
    this.selectedSlotId.set(slot.id);
    this.selectSlot.emit(slot);
  }

  confirmBook(): void {
    const id = this.selectedSlotId();
    const slot = this.slots().find((s) => s.id === id);
    if (!slot) {
      return;
    }
    this.locallyBookedIds.update((ids) => new Set(ids).add(slot.id));
    this.selectedSlotId.set(null);
    this.book.emit(slot);
  }
}
