import { parseBegin, parsePoints, RoomBoard } from './whiteboard';

const stroke = {
  id: 'stroke-01',
  tool: 'pen' as const,
  color: '#112233',
  size: 4,
};

describe('RoomBoard', () => {
  it('keeps a stroke so a peer who joins later receives it', () => {
    const board = new RoomBoard();
    expect(board.begin('teacher', stroke)).toBe(true);
    expect(
      board.addPoints('teacher', stroke.id, [
        { x: 0.1, y: 0.2 },
        { x: 0.4, y: 0.5 },
      ]),
    ).toBe(true);
    expect(board.end('teacher', stroke.id)).toBe(true);
    expect(board.snapshot()).toEqual([
      { ...stroke, points: [{ x: 0.1, y: 0.2 }, { x: 0.4, y: 0.5 }] },
    ]);
  });

  it('rejects points from the participant who did not start the stroke', () => {
    const board = new RoomBoard();
    board.begin('teacher', stroke);
    expect(board.addPoints('learner', stroke.id, [{ x: 0.2, y: 0.2 }])).toBe(false);
    expect(board.snapshot()[0].points).toEqual([]);
  });

  it('clears every stroke', () => {
    const board = new RoomBoard();
    board.begin('teacher', stroke);
    board.addPoints('teacher', stroke.id, [{ x: 0.2, y: 0.2 }]);
    board.clear();
    expect(board.snapshot()).toEqual([]);
  });

  it('drops malformed drawing payloads', () => {
    expect(parseBegin({ id: 'short', tool: 'pen', color: 'red', size: 4 })).toBeNull();
    expect(parseBegin({ ...stroke, color: '#112233' })).toEqual(stroke);
    expect(parsePoints({ id: stroke.id, points: [{ x: 2, y: 0 }] })).toBeNull();
    expect(parsePoints({ id: stroke.id, points: [{ x: 0.5, y: 0.5 }] })).toEqual({
      id: stroke.id,
      points: [{ x: 0.5, y: 0.5 }],
    });
  });
});
