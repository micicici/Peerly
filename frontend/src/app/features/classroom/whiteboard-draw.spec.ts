import { drawBoard } from './whiteboard-draw';

describe('drawBoard', () => {
  function canvas(): { ctx: CanvasRenderingContext2D; pixel: (x: number, y: number) => Uint8ClampedArray } {
    const el = document.createElement('canvas');
    el.width = 100;
    el.height = 100;
    const ctx = el.getContext('2d');
    if (!ctx) {
      throw new Error('canvas unavailable');
    }
    return {
      ctx,
      pixel: (x, y) => ctx.getImageData(x, y, 1, 1).data,
    };
  }

  it('paints a pen stroke in its color', () => {
    const { ctx, pixel } = canvas();
    drawBoard(
      ctx,
      [
        {
          id: 'stroke-01',
          tool: 'pen',
          color: '#ff0000',
          size: 40,
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.9 },
          ],
        },
      ],
      100,
      100,
    );
    expect(pixel(50, 50)[0]).toBeGreaterThan(200);
    expect(pixel(2, 2)[0]).toBe(255);
    expect(pixel(2, 2)[1]).toBe(255);
    expect(pixel(2, 2)[2]).toBe(255);
  });

  it('erases pixels already on the board', () => {
    const { ctx, pixel } = canvas();
    drawBoard(
      ctx,
      [
        {
          id: 'stroke-01',
          tool: 'pen',
          color: '#ff0000',
          size: 80,
          points: [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 },
          ],
        },
        {
          id: 'eraser-01',
          tool: 'eraser',
          color: '#000000',
          size: 40,
          points: [
            { x: 0.5, y: 0.2 },
            { x: 0.5, y: 0.8 },
          ],
        },
      ],
      100,
      100,
    );
    expect(pixel(50, 50)[3]).toBe(0);
    expect(pixel(10, 50)[0]).toBeGreaterThan(200);
  });
});
