import { BoardPoint, BoardStroke, WhiteboardModel, boardPoint, shouldAppend } from './whiteboard-model';

describe('WhiteboardModel', () => {
  const stroke = {
    id: 'stroke-01',
    tool: 'pen' as const,
    color: '#112233',
    size: 4,
    points: [] as BoardPoint[],
  };

  it('maps a pointer into the board and skips tiny duplicates', () => {
    expect(
      boardPoint(25, 40, { left: 10, top: 10, width: 100, height: 50 }),
    ).toEqual({ x: 0.15, y: 0.6 });
    expect(shouldAppend(undefined, { x: 0.1, y: 0.1 })).toBe(true);
    expect(shouldAppend({ x: 0.1, y: 0.1 }, { x: 0.1001, y: 0.1001 })).toBe(false);
  });

  it('keeps an in-progress stroke when a snapshot arrives', () => {
    const board = new WhiteboardModel();
    board.begin(stroke, true);
    board.points(stroke.id, [
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.4 },
    ]);
    board.applySnapshot([
      {
        id: 'older-01',
        tool: 'pen',
        color: '#abcdef',
        size: 2,
        points: [{ x: 0.2, y: 0.2 }],
      },
    ]);
    expect(board.strokes.map((item) => item.id)).toEqual(['older-01', 'stroke-01']);
    expect(board.strokes[1].points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.4 },
    ]);
  });

  it('clears the board', () => {
    const board = new WhiteboardModel();
    board.begin(stroke, true);
    board.points(stroke.id, [{ x: 0.5, y: 0.5 }]);
    board.clear();
    expect(board.strokes).toEqual([]);
  });
});
