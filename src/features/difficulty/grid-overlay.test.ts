import { SUPPORTED_GRID_SIZES, expectedPieceCount } from '@/game-engine';

/** The grid overlay on the difficulty preview splits into `dim × dim` cells. */
function gridDimFor(pieces: number): number {
  return Math.round(Math.sqrt(pieces));
}

describe('difficulty grid overlay mapping', () => {
  it('turns every supported piece count into a whole-number grid dimension', () => {
    for (const size of SUPPORTED_GRID_SIZES) {
      const dim = gridDimFor(expectedPieceCount(size));
      expect(dim * dim).toBe(expectedPieceCount(size));
    }
  });

  it('matches the expected counts for the headline sizes', () => {
    expect(
      [
        [3, 9],
        [4, 16],
        [6, 36],
        [10, 100],
        [12, 144],
        [16, 256],
        [20, 400],
        [25, 625],
        [28, 784],
      ].map(([size, count]) => [gridDimFor(count), Math.round(Math.sqrt(count))]),
    ).toEqual([
      [3, 3],
      [4, 4],
      [6, 6],
      [10, 10],
      [12, 12],
      [16, 16],
      [20, 20],
      [25, 25],
      [28, 28],
    ]);
  });
});
