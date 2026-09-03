import { clampPieceToBoard } from './tray-geometry';

describe('clampPieceToBoard', () => {
  const board = { width: 288, height: 288 };

  it('leaves a fully-inside piece untouched', () => {
    expect(clampPieceToBoard({ x: 100, y: 100 }, { width: 50, height: 50 }, board)).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('clamps a piece whose origin goes off the top-left edge', () => {
    expect(clampPieceToBoard({ x: -10, y: -15 }, { width: 50, height: 50 }, board)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('clamps a piece whose extent goes past the bottom-right edge', () => {
    expect(clampPieceToBoard({ x: 250, y: 260 }, { width: 50, height: 50 }, board)).toEqual({
      x: 238,
      y: 238,
    });
  });

  it('keeps the whole silhouette inside on each axis independently', () => {
    expect(clampPieceToBoard({ x: -5, y: 260 }, { width: 50, height: 50 }, board)).toEqual({
      x: 0,
      y: 238,
    });
  });

  it('collapses to the board origin when a piece is larger than the board', () => {
    expect(clampPieceToBoard({ x: 10, y: 10 }, { width: 400, height: 400 }, board)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
