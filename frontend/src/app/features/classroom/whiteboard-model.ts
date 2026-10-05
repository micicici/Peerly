export type BoardTool = 'pen' | 'eraser';

export type BoardPoint = {
  x: number;
  y: number;
};

export type BoardStroke = {
  id: string;
  tool: BoardTool;
  color: string;
  size: number;
  points: BoardPoint[];
};

const MIN_SPACING = 0.0015;

export function boardPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): BoardPoint | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}

export function shouldAppend(prev: BoardPoint | undefined, next: BoardPoint): boolean {
  if (!prev) {
    return true;
  }
  const dx = prev.x - next.x;
  const dy = prev.y - next.y;
  return dx * dx + dy * dy >= MIN_SPACING * MIN_SPACING;
}

export function acceptStroke(value: unknown): BoardStroke | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as {
    id?: unknown;
    tool?: unknown;
    color?: unknown;
    size?: unknown;
    points?: unknown;
  };
  if (typeof raw.id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(raw.id)) {
    return null;
  }
  if (raw.tool !== 'pen' && raw.tool !== 'eraser') {
    return null;
  }
  if (typeof raw.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.color)) {
    return null;
  }
  if (typeof raw.size !== 'number' || raw.size < 1 || raw.size > 64) {
    return null;
  }
  const points: BoardPoint[] = [];
  if (raw.points !== undefined) {
    if (!Array.isArray(raw.points)) {
      return null;
    }
    for (const point of raw.points) {
      const next = readPoint(point);
      if (!next) {
        return null;
      }
      points.push(next);
    }
  }
  return {
    id: raw.id,
    tool: raw.tool,
    color: raw.color.toLowerCase(),
    size: raw.size,
    points,
  };
}

export function acceptStrokes(value: unknown): BoardStroke[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => acceptStroke(item))
    .filter((stroke): stroke is BoardStroke => stroke !== null);
}

export function acceptPoints(value: unknown): BoardPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const points: BoardPoint[] = [];
  for (const item of value) {
    const point = readPoint(item);
    if (point) {
      points.push(point);
    }
  }
  return points;
}

export class WhiteboardModel {
  strokes: BoardStroke[] = [];
  private activeId: string | null = null;

  begin(stroke: BoardStroke, local = false): void {
    if (this.strokes.some((item) => item.id === stroke.id)) {
      return;
    }
    this.strokes = [
      ...this.strokes,
      {
        ...stroke,
        points: stroke.points.map((point) => ({ ...point })),
      },
    ];
    if (local) {
      this.activeId = stroke.id;
    }
  }

  points(id: string, points: BoardPoint[]): void {
    const stroke = this.strokes.find((item) => item.id === id);
    if (!stroke) {
      return;
    }
    for (const point of points) {
      const prev = stroke.points[stroke.points.length - 1];
      if (shouldAppend(prev, point)) {
        stroke.points.push({ ...point });
      }
    }
  }

  end(id: string): void {
    if (this.activeId === id) {
      this.activeId = null;
    }
  }

  clear(): void {
    this.strokes = [];
    this.activeId = null;
  }

  applySnapshot(strokes: BoardStroke[]): void {
    const local = this.activeId
      ? this.strokes.find((stroke) => stroke.id === this.activeId)
      : undefined;
    this.strokes = strokes.map(cloneStroke);
    if (!local) {
      return;
    }
    const existing = this.strokes.find((stroke) => stroke.id === local.id);
    if (!existing) {
      this.strokes = [...this.strokes, cloneStroke(local)];
      return;
    }
    if (local.points.length > existing.points.length) {
      existing.points = local.points.map((point) => ({ ...point }));
    }
  }
}

function cloneStroke(stroke: BoardStroke): BoardStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  };
}

function readPoint(value: unknown): BoardPoint | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const point = value as { x?: unknown; y?: unknown };
  if (typeof point.x !== 'number' || typeof point.y !== 'number') {
    return null;
  }
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
    return null;
  }
  return { x: point.x, y: point.y };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
