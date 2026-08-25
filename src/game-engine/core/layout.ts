import type { GridSize, PieceGeometry, Point, Size } from './types';

import { TAB_SIZE_RATIO } from './constants';
import { createSeededRng } from './rng';

/**
 * Logical cell size (points) for a grid. The board scales to fit the viewport,
 * so this sets internal resolution and snap distance, not final on-screen size.
 *
 * Anchored so a 4×4 stays at 72pt (its device-verified value) while denser grids
 * shrink smoothly toward a floor that keeps 10×10 pieces from collapsing.
 */
export function cellSizeForGrid(gridSize: GridSize): number {
  const anchorBoardWidth = 4 * 72;
  return Math.max(28, Math.round(anchorBoardWidth / gridSize));
}

/** Deterministic Fisher-Yates. Same seed always produces the same tray order. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }

  return result;
}

export type LayoutMode = 'tray' | 'scatter';

/**
 * The order unplaced pieces are presented in, shuffled deterministically.
 *
 * Separate from `trayPositions` because the two are consumed by different things.
 * A position only says "not on the board" to the renderer — the tray strip lays its
 * pieces out on its own grid, by their index in this order, and discards the x/y
 * here entirely. So shuffling slot assignment below does nothing for what the player
 * sees: the strip was drawing pieces in `generatePuzzlePieces`' row-major emission
 * order, which stacks image row 0 into tray column 0 and shows the solved picture
 * transposed. The puzzle gave itself away in its own tray.
 *
 * Returned as a fixed order for the whole puzzle, not recomputed against whatever is
 * left unplaced. Re-shuffling the survivors on each placement would relocate every
 * remaining piece the moment one was placed.
 */
export function trayOrder(pieceIds: readonly string[], seed: string): string[] {
  return shuffled(pieceIds, createSeededRng(`${seed}:tray-order`));
}

export interface LayoutOptions {
  pieces: readonly PieceGeometry[];
  boardSize: Size;
  mode: LayoutMode;
  seed: string;
  /** Gap between tray slots. Defaults to 8. */
  gap?: number;
  /** Extra vertical space below the board reserved for the tray. Defaults to 1.35 × board height. */
  trayHeightFactor?: number;
}

function trayPositions(
  pieces: readonly PieceGeometry[],
  boardSize: Size,
  seed: string,
  gap: number,
): Record<string, Point> {
  const columns = Math.ceil(Math.sqrt(pieces.length));
  const cellSize = boardSize.width / columns;
  // Slots must clear the tab overhang, otherwise neighbouring pieces overlap and
  // the tray reads as one continuous image instead of separate pieces.
  const slotWidth = cellSize + cellSize * TAB_SIZE_RATIO + gap;
  const slotHeight = cellSize + cellSize * TAB_SIZE_RATIO * 2 + gap;
  const trayTop = boardSize.height + gap * 2;
  const positions: Record<string, Point> = {};

  // Laying pieces out in generation order would rebuild the solved picture in the
  // tray and give the whole puzzle away, so slot assignment is shuffled.
  shuffled(pieces, createSeededRng(`${seed}:tray`)).forEach((piece, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions[piece.id] = {
      x: column * slotWidth + gap,
      y: trayTop + row * slotHeight + gap,
    };
  });

  return positions;
}

function scatterPositions(
  pieces: readonly PieceGeometry[],
  boardSize: Size,
  seed: string,
  gap: number,
  trayHeightFactor: number,
): Record<string, Point> {
  const random = createSeededRng(`${seed}:scatter`);
  const trayTop = boardSize.height + gap;
  const trayHeight = boardSize.height * trayHeightFactor;
  const positions: Record<string, Point> = {};

  for (const piece of pieces) {
    positions[piece.id] = {
      x: random() * Math.max(boardSize.width - gap * 2, gap),
      y: trayTop + random() * Math.max(trayHeight - gap * 2, gap),
    };
  }

  return positions;
}

/**
 * Deterministic initial piece placement outside the solved board area.
 */
export function createInitialPositions({
  pieces,
  boardSize,
  mode,
  seed,
  gap = 8,
  trayHeightFactor = 1.35,
}: LayoutOptions): Record<string, Point> {
  if (boardSize.width <= 0 || boardSize.height <= 0) {
    throw new RangeError('Board size must be positive.');
  }

  if (mode === 'tray') {
    return trayPositions(pieces, boardSize, seed, gap);
  }

  return scatterPositions(pieces, boardSize, seed, gap, trayHeightFactor);
}
