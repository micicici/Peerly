export type WhiteboardTool = 'pen' | 'eraser';

export type WhiteboardPoint = {
  x: number;
  y: number;
};

export type WhiteboardStroke = {
  id: string;
  tool: WhiteboardTool;
  color: string;
  size: number;
  points: WhiteboardPoint[];
};

const MAX_STROKES = 300;
const MAX_POINTS = 2000;
const MAX_BATCH = 40;

export function parseBegin(body: unknown): Omit<WhiteboardStroke, 'points'> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const raw = body as Record<string, unknown>;
  const id = readId(raw.id);
  const tool = raw.tool === 'eraser' ? 'eraser' : raw.tool === 'pen' ? 'pen' : null;
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)
    ? raw.color.toLowerCase()
    : null;
  const size = typeof raw.size === 'number' && raw.size >= 1 && raw.size <= 64
    ? raw.size
    : null;
  if (!id || !tool || !color || size == null) {
    return null;
  }
  return { id, tool, color, size };
}

export function parsePoints(body: unknown): { id: string; points: WhiteboardPoint[] } | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const raw = body as Record<string, unknown>;
  const id = readId(raw.id);
  if (!id || !Array.isArray(raw.points) || raw.points.length === 0) {
    return null;
  }
  const points: WhiteboardPoint[] = [];
  for (const point of raw.points.slice(0, MAX_BATCH)) {
    const next = readPoint(point);
    if (!next) {
      return null;
    }
    points.push(next);
  }
  return { id, points };
}

export function parseEnd(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  return readId((body as { id?: unknown }).id);
}

export class RoomBoard {
  private readonly strokes: (WhiteboardStroke & { userId: string })[] = [];
  private readonly open = new Set<string>();

  begin(userId: string, stroke: Omit<WhiteboardStroke, 'points'>): boolean {
    if (this.strokes.some((item) => item.id === stroke.id)) {
      return false;
    }
    while (
      this.strokes.length >= MAX_STROKES &&
      this.strokes.some((item) => !this.open.has(item.id))
    ) {
      const index = this.strokes.findIndex((item) => !this.open.has(item.id));
      this.strokes.splice(index, 1);
    }
    if (this.strokes.length >= MAX_STROKES) {
      return false;
    }
    this.strokes.push({ ...stroke, userId, points: [] });
    this.open.add(stroke.id);
    return true;
  }

  addPoints(userId: string, id: string, points: WhiteboardPoint[]): boolean {
    const stroke = this.strokes.find((item) => item.id === id);
    if (!stroke || stroke.userId !== userId || !this.open.has(id)) {
      return false;
    }
    const room = MAX_POINTS - stroke.points.length;
    if (room <= 0) {
      return false;
    }
    stroke.points.push(...points.slice(0, room));
    return true;
  }

  end(userId: string, id: string): boolean {
    const stroke = this.strokes.find((item) => item.id === id);
    if (!stroke || stroke.userId !== userId || !this.open.has(id)) {
      return false;
    }
    this.open.delete(id);
    return true;
  }

  clear(): void {
    this.strokes.length = 0;
    this.open.clear();
  }

  snapshot(): WhiteboardStroke[] {
    return this.strokes.map((stroke) => ({
      id: stroke.id,
      tool: stroke.tool,
      color: stroke.color,
      size: stroke.size,
      points: stroke.points.map((point) => ({ ...point })),
    }));
  }
}

function readId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value)
    ? value
    : null;
}

function readPoint(value: unknown): WhiteboardPoint | null {
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
