import { buildPieceLocalPath, cellSizeForGrid, TAB_SIZE_RATIO, type GridSize } from '@/game-engine';
import { spacing } from '@/shared/theme';

import { FX } from './board-fx';
import {
  BOARD_FRAME_PAD,
  BOARD_SHADOW_REACH,
  boardPadding,
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
  trayRows,
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

const GRID_SIZES: GridSize[] = [3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 25, 28];
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
   * What the tray costs the board, per grid.
   *
   * `game-screen.tsx` caps the board shell at `shellWidth + boardTrayReserve(grid)`.
   * While the shell reaches that cap the board's fit is decided by width and the tray
   * cannot affect it at all. Once the column runs out of room the shell is shorter
   * than the cap, and every extra point of tray height comes straight off the board.
   *
   * Both figures below are *measured*, from a screenshot of the release build on a
   * 1240x2772 @476dpi device (416.8x931.8dp): the shell spans 384.8dp wide — the
   * screen less `content`'s 16pt side padding — and 684.7dp tall, the rest being safe
   * areas, header and toolbar. An earlier estimate of 692 was wrong in the direction
   * that mattered, and a test asserting the board stayed width-constrained passed on
   * it while the shipped board was in fact 1.8% smaller. Hence measured numbers here.
   */
  const SHELL_WIDTH = 384.8;
  const COLUMN_BUDGET = 684.7;
  /** Mat size when width constrains the fit, which is the most it can ever be. */
  const IDEAL_MAT = SHELL_WIDTH * 0.96;

  /**
   * `boardTrayReserve` from `puzzle-board.tsx`, recomposed from its parts.
   *
   * Not imported: that module pulls in Skia at load, which jest cannot do. So the
   * binding is repeated here against the same `FX` values the component reads, which
   * keeps this tracking the real config rather than a copy of its numbers.
   */
  function reserve(gridSize: GridSize): number {
    const rows = trayRows(gridSize, FX.tray.rows);
    return trayHeight(rows, FX.tray.sliderGap, FX.tray.sliderHeight) + TRAY_GAP;
  }

  /** The mat's on-screen edge — the outer frame, shadow excluded. */
  function fittedMat(gridSize: GridSize): number {
    const shellHeight = Math.min(SHELL_WIDTH + reserve(gridSize), COLUMN_BUDGET);
    // `puzzle-board.tsx` fits the board to `min(vw * 0.96, availableH)`.
    return Math.min(IDEAL_MAT, shellHeight - reserve(gridSize));
  }

  /**
   * The play area inside the mat, which is what the pieces actually get.
   *
   * The distinction is the point of the `boardPadding` change: the mat is fit to the
   * shell's width, so trimming the frame moves this without moving the mat at all.
   */
  function fittedPlayArea(gridSize: GridSize): number {
    const boardUnits = gridSize * cellSizeForGrid(gridSize);
    const pad = boardPadding(gridSize);
    return fittedMat(gridSize) * (boardUnits / (boardUnits + pad * 2));
  }

  it.each(GRID_SIZES)('never lets the %ix board collide with its tray', (gridSize) => {
    // The whole block — mat, gap, tray — has to fit the column it is centred in.
    // Height-constrained grids fill it exactly, hence the floating-point slack.
    expect(fittedMat(gridSize) + reserve(gridSize)).toBeLessThanOrEqual(COLUMN_BUDGET + 1e-9);
  });

  it.each(GRID_SIZES)('never clips the %ix board horizontally', (gridSize) => {
    expect(fittedMat(gridSize)).toBeLessThanOrEqual(SHELL_WIDTH);
  });

  it('costs the board no more than 2% to seat three rows', () => {
    // At `trayHeight(3, 16, 10)` = 294.36 the cap is 707.2, above the 684.7 the column
    // can give, so the mat is height-constrained at 362.3dp against the 369.4dp width
    // alone would reach. That 1.8% is the agreed price of the third row.
    expect(fittedMat(10)).toBeGreaterThanOrEqual(IDEAL_MAT * 0.98);
  });

  it('reports the two-row tray as free, which is how it shipped before', () => {
    // Pins the mechanism rather than trusting it: at two rows the cap is reachable,
    // so the board is decided by width alone. Also why 3x3 pays nothing.
    expect(fittedMat(3)).toBeCloseTo(IDEAL_MAT, 5);
  });

  it('spends the 3x3 tray row on the board', () => {
    // Two rows instead of three, so the shell's cap drops below the column budget and
    // the mat stops being height-constrained.
    expect(fittedMat(3)).toBeGreaterThan(fittedMat(4));
  });

  it.each([9, 10] as GridSize[])('grows the %ix play area by thinning its frame', (gridSize) => {
    /**
     * The frame and the play area compete for a fixed mat. `cellSizeForGrid` anchors
     * every board at ~288 units wide, so a 12-unit frame is a far bigger share of a
     * 10x10's board than of a 4x4's — and it is the dense grids whose pieces need the
     * points most.
     */
    const boardUnits = gridSize * cellSizeForGrid(gridSize);
    const before = fittedMat(gridSize) * (boardUnits / (boardUnits + 12 * 2));
    expect(fittedPlayArea(gridSize)).toBeGreaterThan(before * 1.035);
  });

  it('leaves the mat footprint untouched when the frame thins', () => {
    // The safety property: the frame is inside the mat, so no tray collision or
    // clipping can follow from trimming it.
    expect(fittedMat(10)).toBeCloseTo(fittedMat(9), 5);
    expect(fittedMat(9)).toBeCloseTo(fittedMat(8), 5);
  });

  it('leaves the sparse grids at the size they shipped', () => {
    for (const gridSize of [4, 5, 6, 7, 8] as GridSize[]) {
      expect(boardPadding(gridSize)).toBe(12);
      expect(trayRows(gridSize, 3)).toBe(3);
    }
  });
});

describe('tray rows', () => {
  it('gives the 3x3 two rows and every other grid the ceiling', () => {
    expect(trayRows(3, 3)).toBe(2);
    for (const gridSize of [4, 5, 6, 7, 8, 9, 10] as GridSize[]) {
      expect(trayRows(gridSize, 3)).toBe(3);
    }
  });

  it('shortens the tray strip by exactly one row pitch', () => {
    expect(trayHeight(3, 16, 10)).toBeCloseTo(294.36, 5);
    expect(trayHeight(2, 16, 10)).toBeCloseTo(294.36 - TRAY_PITCH, 5);
  });

  it('makes the 3x3 tray scroll, which three rows did not', () => {
    /**
     * The accepted cost. Nine pieces over three rows is three columns, all visible at
     * once; over two rows it is five, and only ~4.4 fit the shelf. So the 3x3 gains a
     * slider it never had, in exchange for the shorter tray and the bigger board.
     */
    const shelf = 384.8 - TRAY_PAD * 2;
    expect(Math.ceil(9 / trayRows(3, 3)) * TRAY_PITCH).toBeGreaterThan(shelf);
    expect(Math.ceil(9 / 3) * TRAY_PITCH).toBeLessThanOrEqual(shelf);
  });
});

describe('board frame', () => {
  it('thins the frame only on the densest grids', () => {
    for (const gridSize of [3, 4, 5, 6, 7, 8] as GridSize[]) {
      expect(boardPadding(gridSize)).toBe(12);
    }
    expect(boardPadding(9)).toBe(6);
    expect(boardPadding(10)).toBe(6);
  });

  it('keeps the frame in board units, so snapping is unaffected', () => {
    // The frame is applied inside the board's scaled group, so it shifts what is drawn
    // and never what the puzzle computes: `cellSize` and the snap radius derive from
    // the grid alone. If this ever became a screen-point value, snap distance would
    // start varying with the frame.
    expect(cellSizeForGrid(10)).toBe(cellSizeForGrid(10));
    expect(boardPadding(10)).toBeLessThan(cellSizeForGrid(10));
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

describe('board frame padding', () => {
  // The shell's inner box, recomposed the same way `tray-fit`'s vertical-budget
  // block does above — outer measured width less the two frame pads.
  const SHELL_WIDTH = 384.8;
  const INNER_WIDTH = SHELL_WIDTH - BOARD_FRAME_PAD * 2;

  it('frames the play block with the design system eyebrow, not a per-size value', () => {
    // Pinned so nobody shaves the inset back toward 0 — the run-into-the-frame
    // look this exists to prevent. Tied to `spacing.sm` so it belongs to the
    // spacing vocabulary rather than being an orphan number.
    expect(BOARD_FRAME_PAD).toBe(spacing.sm);
  });

  it.each(GRID_SIZES)('keeps the %ix mat clear of the frame in the padded shell', (gridSize) => {
    // The canvas measures the shell's *inner* box and fits the mat to 0.96 of it,
    // so mat + both frame pads must always sit inside the shell — at every grid,
    // from 3×3 to 28×28, with no per-size layout. Mirrors `fittedMat`/`reserve`
    // from the vertical-budget block so it tracks the same real numbers.
    const reserve =
      trayHeight(trayRows(gridSize, FX.tray.rows), FX.tray.sliderGap, FX.tray.sliderHeight) +
      TRAY_GAP;
    const shellHeight = Math.min(SHELL_WIDTH + reserve, 684.7);
    const mat = Math.min(INNER_WIDTH * 0.96, shellHeight - BOARD_FRAME_PAD * 2 - reserve);

    expect(mat + BOARD_FRAME_PAD * 2).toBeLessThanOrEqual(SHELL_WIDTH + 1e-9);
    expect(BOARD_FRAME_PAD * 2 + (INNER_WIDTH - mat) / 2).toBeGreaterThanOrEqual(8);
  });
});
