import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { drawBoard } from './whiteboard-draw';
import { BoardPoint, BoardStroke, boardPoint } from './whiteboard-model';
import { ClassroomSession } from './classroom-session';

@Component({
  selector: 'app-whiteboard',
  template: `
    <div class="board">
      <div class="board-tools">
        <label>
          Color
          <input
            type="color"
            [value]="color()"
            [disabled]="eraser()"
            (input)="onColor($event)"
          />
        </label>
        <label>
          Thickness
          <input
            type="range"
            min="2"
            max="28"
            [value]="size()"
            (input)="onSize($event)"
          />
        </label>
        <button
          type="button"
          [attr.aria-pressed]="eraser()"
          (click)="toggleEraser()"
        >
          Eraser
        </button>
        <button type="button" (click)="clearBoard()">Clear Board</button>
      </div>
      <div class="surface" #surface>
        <canvas
          #canvas
          aria-label="Drawing surface"
          (pointerdown)="down($event)"
          (pointermove)="move($event)"
          (pointerup)="up($event)"
          (pointercancel)="up($event)"
        ></canvas>
      </div>
    </div>
  `,
  styleUrl: './whiteboard.css',
})
export class WhiteboardComponent {
  readonly session = input.required<ClassroomSession>();
  readonly color = signal('#1d4ed8');
  readonly size = signal(4);
  readonly eraser = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');
  private readonly observer = new ResizeObserver(() => this.layout());
  private cssWidth = 0;
  private cssHeight = 0;
  private activeId: string | null = null;
  private drawing = false;
  private outgoing: BoardPoint[] = [];
  private flushTimer: number | null = null;
  private paintFrame: number | null = null;
  private unsubscribe = (): void => undefined;

  constructor() {
    afterNextRender(() => {
      const surface = this.surface()?.nativeElement;
      if (surface) {
        this.observer.observe(surface);
      }
      this.unsubscribe = this.session().subscribeBoard(() => this.requestPaint());
      this.layout();
    });
    this.destroyRef.onDestroy(() => {
      this.unsubscribe();
      this.observer.disconnect();
      if (this.flushTimer != null) {
        window.clearTimeout(this.flushTimer);
      }
      if (this.paintFrame != null) {
        cancelAnimationFrame(this.paintFrame);
      }
    });
  }

  onColor(event: Event): void {
    this.color.set((event.target as HTMLInputElement).value);
    this.eraser.set(false);
  }

  onSize(event: Event): void {
    this.size.set(Number((event.target as HTMLInputElement).value));
  }

  toggleEraser(): void {
    this.eraser.update((on) => !on);
  }

  clearBoard(): void {
    this.finishStroke();
    this.session().board.clear();
    this.session().sendBoard('whiteboard-clear');
    this.requestPaint();
  }

  down(event: PointerEvent): void {
    const point = this.locate(event);
    const canvas = this.canvas()?.nativeElement;
    if (!point || !canvas) {
      return;
    }
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is only available for an active pointer.
    }
    const stroke: BoardStroke = {
      id: crypto.randomUUID(),
      tool: this.eraser() ? 'eraser' : 'pen',
      color: this.color(),
      size: this.eraser() ? Math.max(this.size(), 18) : this.size(),
      points: [point],
    };
    this.activeId = stroke.id;
    this.drawing = true;
    this.outgoing = [];
    this.session().board.begin(stroke, true);
    this.session().sendBoard('whiteboard-begin', {
      id: stroke.id,
      tool: stroke.tool,
      color: stroke.color,
      size: stroke.size,
    });
    this.requestPaint();
  }

  move(event: PointerEvent): void {
    if (!this.drawing || !this.activeId) {
      return;
    }
    const samples = event.getCoalescedEvents?.() ?? [];
    const events = samples.length > 0 ? samples : [event];
    const points = events
      .map((sample) => this.locate(sample))
      .filter((point): point is BoardPoint => point !== null);
    if (points.length === 0) {
      return;
    }
    this.session().board.points(this.activeId, points);
    this.outgoing.push(...points);
    if (this.outgoing.length >= 16) {
      this.flushPoints();
    } else {
      this.scheduleFlush();
    }
    this.requestPaint();
  }

  up(event: PointerEvent): void {
    if (!this.activeId) {
      return;
    }
    const point = this.locate(event);
    if (point) {
      this.session().board.points(this.activeId, [point]);
      this.outgoing.push(point);
    }
    this.finishStroke();
    this.requestPaint();
    const canvas = this.canvas()?.nativeElement;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer may already have been released.
      }
    }
  }

  private finishStroke(): void {
    const id = this.activeId;
    if (!id) {
      return;
    }
    this.flushPoints();
    this.session().board.end(id);
    this.session().sendBoard('whiteboard-end', { id });
    this.activeId = null;
    this.drawing = false;
  }

  private scheduleFlush(): void {
    if (this.flushTimer != null) {
      return;
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flushPoints();
    }, 32);
  }

  private flushPoints(): void {
    if (this.flushTimer != null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const id = this.activeId;
    if (!id || this.outgoing.length === 0) {
      return;
    }
    const points = this.outgoing.splice(0, 40);
    this.session().sendBoard('whiteboard-points', { id, points });
    if (this.outgoing.length > 0) {
      this.scheduleFlush();
    }
  }

  private locate(event: PointerEvent): BoardPoint | null {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) {
      return null;
    }
    return boardPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
  }

  private layout(): void {
    const canvas = this.canvas()?.nativeElement;
    const surface = this.surface()?.nativeElement;
    if (!canvas || !surface) {
      return;
    }
    const rect = surface.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    canvas.width = Math.max(1, Math.floor(this.cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(this.cssHeight * dpr));
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  private requestPaint(): void {
    if (this.paintFrame != null) {
      return;
    }
    this.paintFrame = requestAnimationFrame(() => {
      this.paintFrame = null;
      this.redraw();
    });
  }

  private redraw(): void {
    const canvas = this.canvas()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx || this.cssWidth <= 0 || this.cssHeight <= 0) {
      return;
    }
    drawBoard(ctx, this.session().board.strokes, this.cssWidth, this.cssHeight);
    if (
      this.activeId &&
      !this.session().board.strokes.some((stroke) => stroke.id === this.activeId)
    ) {
      this.activeId = null;
      this.drawing = false;
      this.outgoing = [];
    }
  }
}
