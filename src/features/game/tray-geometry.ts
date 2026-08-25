import { type GridSize, type PieceLocalPath } from '@/game-engine';

/**
 * Tray slot sizing, kept free of Skia so it can be tested directly.
 *
 * `puzzle-board.tsx` imports Skia at module scope, which jest cannot load, so the
 * arithmetic that decides whether a piece fits its slot lives here instead of
 * beside the component that uses it.
 */

/**
 * Slot edge in points — the basis the largest piece is scaled against, and nothing
 * else.
 *
 * This used to double as the tray's pitch (`TRAY_SLOT + SLOT_GAP` set the distance
 * between slot centres), which is what made the tray look mostly empty. The largest
 * piece fills only `TRAY_SLOT_FILL` of the slot, so every slot carried
 * `TRAY_SLOT * (1 - TRAY_SLOT_FILL)` — about 13pt — of dead margin *inside* it, on
 * top of the explicit gap between slots. Pitch is now `TRAY_PITCH`, measured from
 * the piece itself, and this value governs the piece's size alone.
 *
 * Do not change this or `TRAY_SLOT_FILL` to adjust spacing: their product is the
 * drawn piece size, which `tray-fit.test.ts` pins.
 */
export const TRAY_SLOT = 92;

/** Fraction of a slot the largest piece is allowed to fill. */
export const TRAY_SLOT_FILL = 0.86;

/**
 * The largest piece's drawn extent in points — the real footprint of a tray piece.
 *
 * Every piece shares one scale (see `trayThumbScale`), so this is the worst case: a
 * piece with opposing tabs. Most pieces measure well under it, which is why the tray
 * reads as sparser than the arithmetic suggests.
 */
export const TRAY_PIECE = TRAY_SLOT * TRAY_SLOT_FILL;

/**
 * Clear space between two neighbouring pieces, in points.
 *
 * Not cosmetic: this is the lane you drag to scroll the strip. The tray hit-test
 * treats a touch on a piece as a grab and a touch beside one as a scroll, so with no
 * channel the tray can only be moved by its slider — see `TRAY_GRAB_HALF` in
 * `puzzle-board.tsx`, which documents that exact regression.
 *
 * 5 is the agreed floor. It was ~19pt, which fit only 3.68 of the intended 4 columns
 * in the board shell and left the fourth piece clipped.
 */
export const TRAY_CHANNEL = 5;

/**
 * Distance between neighbouring slot centres, on both axes.
 *
 * Derived from the piece rather than the slot so the gap between pieces is stated
 * once, directly, instead of emerging from a slot's leftover margin plus a separate
 * inter-slot gap.
 */
export const TRAY_PITCH = TRAY_PIECE + TRAY_CHANNEL;

/** Padding between the tray shelf's edge and its piece grid, in points. */
export const TRAY_PAD = 8;

/**
 * The board mat's drop shadow, in points.
 *
 * `blur` is a Gaussian sigma, so the shadow stays visible for roughly two sigma
 * past its offset — `BOARD_SHADOW_REACH` below.
 */
export const BOARD_SHADOW = { dy: 5, blur: 10 } as const;

/** How far below the mat its shadow is still visible. */
export const BOARD_SHADOW_REACH = BOARD_SHADOW.dy + BOARD_SHADOW.blur * 2;

/**
 * Gap between the fitted board and the tray shelf.
 *
 * Must be at least `BOARD_SHADOW_REACH`, because the board zone is clipped at the
 * tray line to stop panned board content bleeding onto the shelf. At the old 14 the
 * mat's shadow was still strong where that clip fell, so it was sliced flat in a
 * straight line just above the tray — a hard horizontal edge under a soft shadow,
 * which read as the board being cut off. Widening the gap lets the shadow fade out
 * completely on its own before the clip is reached, so nothing needs to be cut.
 */
export const TRAY_GAP = 28;

/**
 * Total height of the tray strip: padding, the piece rows, then the slider.
 *
 * Rows are `TRAY_PITCH` tall rather than `TRAY_SLOT` tall. Sizing the band by the
 * slot padded the strip by the slot's unused margin twice over — once above the top
 * row and once below the bottom — which is height the board could have had.
 *
 * Takes the slider's dimensions as arguments rather than importing `FX`, so the
 * geometry stays independent of the effects config: `board-fx.ts` owns tuning the
 * player can feel, this file owns arithmetic, and the dependency runs one way only.
 * The caller in `puzzle-board.tsx` binds the two together.
 */
export function trayHeight(rows: number, sliderGap: number, sliderHeight: number): number {
  return TRAY_PAD * 2 + rows * TRAY_PITCH + sliderGap + sliderHeight;
}

/**
 * How many rows the tray lays its pieces out in.
 *
 * `maxRows` for every grid except 3x3, which uses two. Rows are the tray's cost to
 * the board — each one is `TRAY_PITCH` of height the board cannot have — and a 3x3
 * has only nine pieces, so a third row buys a third column instead of a wider strip:
 * a tall tray holding a narrow block, with empty shelf to its right. Two rows spend
 * that height on the board and the pieces across the width already there.
 *
 * Keyed on the grid, deliberately, and not on how many pieces are still unplaced.
 * Deriving it from the remaining count would restyle the tray mid-game, and since
 * the board is fitted against the tray's height the board would jump on whichever
 * placement crossed the boundary.
 *
 * Takes `maxRows` rather than reading `FX.tray.rows` for the same reason
 * `trayHeight` takes the slider's dimensions — see that function.
 */
export function trayRows(gridSize: GridSize, maxRows: number): number {
  return gridSize === 3 ? 2 : maxRows;
}

/**
 * The cream frame between the mat's edge and the play area, in board units.
 *
 * Thinner on the densest grids. The board is fit to the shell's width, so the mat's
 * on-screen size is effectively fixed and the frame and the play area compete for
 * it: `cellSizeForGrid` anchors every board at ~288 units wide whatever the grid,
 * which leaves a 10x10's cells at 29 units against a 4x4's 72. Trimming the frame on
 * those grids hands the difference to the pieces without moving the mat's footprint
 * by a single point, so nothing can collide with the tray.
 *
 * Board units, so `cellSize` and the snap radius are untouched — this changes what
 * the player sees, not what the puzzle computes.
 */
export const BOARD_PADDING = 12;

/** `BOARD_PADDING` for 9x9 and 10x10 — see `boardPadding`. */
export const BOARD_PADDING_DENSE = 6;

/** The frame width for a grid, in board units. */
export function boardPadding(gridSize: GridSize): number {
  return gridSize >= 9 ? BOARD_PADDING_DENSE : BOARD_PADDING;
}

/**
 * The largest extent any of these pieces actually occupies, in board units.
 *
 * Measured from the generated paths instead of predicted from `cellSize`, which is
 * what made pieces overflow their tray slots. The obvious prediction —
 * `cellSize * (1 + 2 * TAB_SIZE_RATIO)`, a cell plus a tab each side — understates
 * the real bounds by 12.9%, because bounds come from the curves' *control points*
 * and a tab's control hull reaches about 1.45x the nominal tab depth. At `cellSize`
 * 72 a two-tab piece measures 113.76 units against the predicted 100.8. With only a
 * 14% slot margin that 12.9% left 3%, so the biggest pieces filled 97% of their slot
 * and crowded into the gap between them.
 */
export function maxPieceExtent(paths: Iterable<PieceLocalPath>): number {
  let extent = 0;
  for (const { bounds } of paths) {
    extent = Math.max(extent, bounds.width, bounds.height);
  }
  return extent;
}

/**
 * Scale that fits the largest piece inside a tray slot.
 *
 * One scale for every piece in the puzzle, not one per piece: pieces must stay the
 * same size relative to each other, so they are all scaled by the biggest.
 */
export function trayThumbScale(slotInner: number, pieceExtent: number): number {
  if (pieceExtent <= 0) {
    return 1;
  }
  return (slotInner * TRAY_SLOT_FILL) / pieceExtent;
}

/**
 * Hold a tray scroll offset inside the range the current content allows.
 *
 * Offsets run `0` (leftmost) to `-overflow` (rightmost). Placing pieces shrinks the
 * content and therefore the overflow, so an offset that was valid a moment ago can
 * end up past the new limit — which parked the remaining pieces off the shelf, and
 * once the overflow hit 0 the slider unmounted and left no way to scroll back.
 */
export function clampTrayScroll(offset: number, overflow: number): number {
  const clamped = Math.min(0, Math.max(-Math.max(0, overflow), offset));
  // `Math.max(-0, x)` yields -0 when the overflow is zero. It behaves as 0 in a
  // transform, but returning it leaks negative zero into callers' comparisons.
  return clamped === 0 ? 0 : clamped;
}
