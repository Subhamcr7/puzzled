import { TAB_SIZE_RATIO } from './constants';
import { generatePuzzlePieces } from './generate';
import { createInitialPositions, trayOrder } from './layout';
import type { PuzzleDefinition } from './types';

const puzzle: PuzzleDefinition = {
  id: 'layout-check',
  title: 'Layout Check',
  image: { uri: 'asset://layout', pixelSize: { width: 800, height: 800 } },
  gridSize: 4,
  seed: 'layout-seed',
  revision: 1,
};

const CELL = 72;
const generated = generatePuzzlePieces({ puzzle, cellSize: CELL });

function trayPositions(seed = puzzle.seed) {
  return createInitialPositions({
    pieces: generated.pieces,
    boardSize: generated.boardSize,
    mode: 'tray',
    seed,
  });
}

describe('tray layout', () => {
  it('starts every piece below the solved board', () => {
    const positions = trayPositions();

    for (const piece of generated.pieces) {
      expect(positions[piece.id].y).toBeGreaterThanOrEqual(generated.boardSize.height);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(trayPositions()).toEqual(trayPositions());
  });

  it('does not rebuild the solved picture in the tray', () => {
    const positions = trayPositions();

    // If slots were filled in generation order, every piece's tray column would
    // match its solved column — which would show the finished image in rows.
    const columnsMatchingSolvedOrder = generated.pieces.filter((piece) => {
      const trayColumn = Math.round(positions[piece.id].x / CELL);
      return trayColumn === piece.column;
    }).length;

    expect(columnsMatchingSolvedOrder).toBeLessThan(generated.pieces.length);
  });

  it('spaces slots wide enough to clear tab overhang', () => {
    const positions = trayPositions();
    const tab = CELL * TAB_SIZE_RATIO;

    // Group pieces by tray row, then check neighbouring slots cannot collide.
    const byRow = new Map<number, number[]>();
    for (const piece of generated.pieces) {
      const { x, y } = positions[piece.id];
      const row = Math.round(y);
      byRow.set(row, [...(byRow.get(row) ?? []), x]);
    }

    for (const xs of byRow.values()) {
      const sorted = [...xs].sort((a, b) => a - b);
      for (let index = 1; index < sorted.length; index += 1) {
        expect(sorted[index] - sorted[index - 1]).toBeGreaterThan(CELL + tab * 0.5);
      }
    }
  });
});

describe('tray order', () => {
  const ids = generated.pieces.map((piece) => piece.id);

  it('is deterministic for a given seed', () => {
    expect(trayOrder(ids, 'seed-a')).toEqual(trayOrder(ids, 'seed-a'));
  });

  it('differs between seeds', () => {
    expect(trayOrder(ids, 'seed-a')).not.toEqual(trayOrder(ids, 'seed-b'));
  });

  it('presents every piece exactly once', () => {
    // A shuffle that dropped or duplicated an id would strand pieces off the tray or
    // draw one twice, so this is the property the strip actually depends on.
    expect([...trayOrder(ids, 'seed-a')].sort()).toEqual([...ids].sort());
  });

  it('does not present pieces in solved order', () => {
    /**
     * The reason this function exists. The tray strip lays pieces out by their index
     * in this order, and previously had no order of its own, so it drew
     * `generatePuzzlePieces`' row-major output — image row 0 became tray column 0 and
     * the shelf displayed the solved picture transposed.
     */
    expect(trayOrder(ids, 'seed-a')).not.toEqual(ids);
  });

  it('holds a piece still while its neighbours are placed', () => {
    // The order is fixed for the puzzle, so removing placed pieces preserves the
    // relative order of the rest. Recomputing it against the shrinking tray instead
    // would shuffle the survivors on every placement.
    const order = trayOrder(ids, 'seed-a');
    const remaining = order.filter((_, index) => index % 3 !== 0);
    const rank = new Map(order.map((id, index) => [id, index]));

    expect([...remaining].sort((a, b) => rank.get(a)! - rank.get(b)!)).toEqual(remaining);
  });
});
