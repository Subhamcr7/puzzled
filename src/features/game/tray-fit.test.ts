import { buildPieceLocalPath, cellSizeForGrid, TAB_SIZE_RATIO, type GridSize } from '@/game-engine';

import {
  BOARD_SHADOW_REACH,
  clampTrayScroll,
  maxPieceExtent,
  TRAY_CHANNEL,
  TRAY_GAP,
  TRAY_PAD,
  TRAY_PIECE,
  TRAY_PITCH,
  TRAY_SLOT,
  TRAY_SLOT_FILL,
  trayHeight,
  trayThumbScale,
} from './tray-geometry';

/**
 * Pieces overflowed their tray slots, and the cause was a prediction standing in
 * for a measurement: the tray scaled pieces by `cellSize * (1 + 2 * TAB_SIZE_RATIO)`
 * — a cell plus one tab each side — while real bounds are taken from the curves'
 * control points and run 12.9% larger.
 *
 * These tests assert the fit itself rather than the constant, so they keep holding
 * if the piece path changes shape.
 */

const GRID_SIZES: GridSize[] = [3, 4, 5, 6, 7, 8, 9, 10];
const EDGE_VALUES = [-1, 0, 1] as const;

/** Every distinct piece shape the generator can produce, for one cell size. */
function allPieceShapes(cellSize: number) {
  const cell = { width: cellSize, height: cellSize };
  const paths = [];
  for (const top of EDGE_VALUES) {
    for (const right of EDGE_VALUES) {
      for (const bottom of EDGE_VALUES) {
        for (const left of EDGE_VALUES) {
          paths.push(buildPieceLocalPath({ top, right, bottom, left }, cell));
        }
      }
    }
  }
  return paths;
}

describe('tray piece fit', () => {
  it.each(GRID_SIZES)('keeps every %ix piece inside its slot', (gridSize) => {
    const cellSize = cellSizeForGrid(gridSize);
    const shapes = allPieceShapes(cellSize);
    const scale = trayThumbScale(TRAY_SLOT, maxPieceExtent(shapes));

    for (const { bounds } of shapes) {
      expect(bounds.width * scale).toBeLessThanOrEqual(TRAY_SLOT);
      expect(bounds.height * scale).toBeLessThanOrEqual(TRAY_SLOT);
    }
  });

  it('leaves a real margin rather than filling the slot edge to edge', () => {
    const shapes = allPieceShapes(cellSizeForGrid(4));
    const extent = maxPieceExtent(shapes);
    // The largest piece should land near the intended fill fraction, so slots read
    // as separate. Before the fix the effective figure was 0.97.
    expect(extent * trayThumbScale(TRAY_SLOT, extent)).toBeLessThanOrEqual(TRAY_SLOT * 0.9);
  });

  it('measures a larger extent than the cell-plus-tabs prediction', () => {
    // Pins the reason the prediction was abandoned. If the path ever shrinks inside
    // its prediction this fails, and the comment in `maxPieceExtent` needs revising.
    const cellSize = cellSizeForGrid(4);
    const predicted = cellSize * (1 + 2 * TAB_SIZE_RATIO);
    expect(maxPieceExtent(allPieceShapes(cellSize))).toBeGreaterThan(predicted);
  });
});

describe('board shadow clearance', () => {
  it('leaves the mat shadow room to fade before the tray line clips it', () => {
    // The board zone is clipped at the tray line so panned board content cannot
    // bleed onto the shelf. If the shadow is still visible where that clip falls it
    // gets sliced into a hard horizontal edge just above the tray, which reads as
    // the board being cut off rather than as a shadow.
    expect(TRAY_GAP).toBeGreaterThanOrEqual(BOARD_SHADOW_REACH);
  });
});

describe('tray pitch', () => {
  /**
   * The tray was tightened to fit more pieces on screen, under an explicit
   * requirement that the pieces themselves not change size. Spacing now comes from
   * `TRAY_PITCH`; size still comes from `TRAY_SLOT * TRAY_SLOT_FILL`. These pin that
   * separation, because the obvious way to tighten the grid — shrinking the slot —
   * would have shrunk the pieces with it.
   */
  it('draws pieces at the size they have always been', () => {
    // 92 * 0.86. If this changes, pieces changed size and the tightening overreached.
    expect(TRAY_PIECE).toBeCloseTo(79.12, 5);
    expect(TRAY_PIECE).toBeCloseTo(TRAY_SLOT * TRAY_SLOT_FILL, 5);
  });

  it('spaces pieces without letting them touch', () => {
    expect(TRAY_PITCH - TRAY_PIECE).toBeCloseTo(TRAY_CHANNEL, 5);
    expect(TRAY_CHANNEL).toBeGreaterThanOrEqual(5);
  });

  it('keeps a grab target inside its own pitch', () => {
    /**
     * The hit-test treats a square of `TRAY_PIECE` centred on each slot as the piece.
     * If that target were wider than the pitch it would overlap its neighbour's and a
     * touch in the overlap would grab whichever slot the arithmetic reached first —
     * which is what the old `TRAY_SLOT * 0.92` (84.6pt against an 84.1pt pitch) would
     * have done.
     */
    expect(TRAY_PIECE).toBeLessThanOrEqual(TRAY_PITCH);
  });

  it('fits the intended four columns in the board shell', () => {
    // The shelf spans the board shell, not the screen: a 416.8dp-wide phone gives
    // 384.8 once `content`'s 16pt side padding is removed. At the old 98pt pitch only
    // 3.68 columns fit, so the fourth piece was always clipped — the very thing the
    // slot size was documented as fixing.
    const shellWidth = 384.8;
    const columns = (shellWidth - TRAY_PAD * 2) / TRAY_PITCH;
    expect(columns).toBeGreaterThanOrEqual(4);
  });
});

describe('tray vertical budget', () => {
  /**
   * The board must not shrink to pay for the third tray row.
   *
   * `game-screen.tsx` caps the board shell at `shellWidth + BOARD_TRAY_RESERVE`. While
   * the shell reaches that cap the board's fit is decided by width and the tray cannot
   * affect it. Once the column runs out of room the shell is shorter than the cap, and
   * every extra point of tray height comes straight off the board.
   *
   * The chrome figure below is an estimate for the 416.8x931.8dp device this was tuned
   * on (safe areas, header and toolbar), so treat this as the budget being *stated*
   * rather than measured — the on-device check after the build is what confirms it.
   * Its value is that a future tray change which busts the budget fails here instead
   * of silently shrinking the board.
   */
  const SHELL_WIDTH = 384.8;
  const COLUMN_BUDGET = 692;

  it('leaves the board width-constrained rather than height-constrained', () => {
    const shellHeight = Math.min(SHELL_WIDTH + trayHeight(3, 16, 10) + TRAY_GAP, COLUMN_BUDGET);
    const availableH = shellHeight - trayHeight(3, 16, 10) - TRAY_GAP;
    // `puzzle-board.tsx` fits the board to `min(vw * 0.96, availableH)`.
    expect(availableH).toBeGreaterThanOrEqual(SHELL_WIDTH * 0.96);
  });
});

describe('tray scroll clamp', () => {
  it('keeps an in-range offset untouched', () => {
    expect(clampTrayScroll(-40, 100)).toBe(-40);
    expect(clampTrayScroll(0, 100)).toBe(0);
  });

  it('pulls the strip home once everything fits', () => {
    // The bug: pieces get placed, overflow reaches 0, the slider unmounts, and the
    // remaining pieces stay parked off the shelf with no control to fetch them.
    expect(clampTrayScroll(-260, 0)).toBe(0);
  });

  it('pulls a stranded offset back to the new limit as the tray shrinks', () => {
    expect(clampTrayScroll(-260, 80)).toBe(-80);
  });

  it('never scrolls past the leftmost piece', () => {
    expect(clampTrayScroll(50, 100)).toBe(0);
  });
});
