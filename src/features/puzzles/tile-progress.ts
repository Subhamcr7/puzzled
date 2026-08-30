import { type PuzzleProgressSummary } from '@/data';

/**
 * What a grid tile draws over its artwork, if anything.
 *
 * A percentage and a tick are mutually exclusive: two badges on one 48%-wide
 * tile would cover the image the screen exists to show.
 */
export type TileBadge = { kind: 'completed' } | { kind: 'progress'; percent: number };

/**
 * Pick the one badge for a puzzle from its saved boards.
 *
 * `rows` is the slice of `listSummaries()` belonging to a single puzzle, still in
 * the repository's `updated_at DESC` order (`sqlite-progress-repository.ts:68`).
 * Boards are stored per (puzzle, size), so one image can own several rows and
 * this has to choose between them:
 *
 * - **Completed wins outright, from any size.** Having finished the image is the
 *   stronger fact than being part-way through another cut of it, and it must not
 *   depend on which board was touched last.
 * - **Otherwise the most recent board speaks**, because that is the size
 *   `difficulty-screen.tsx:57` will preselect when the tile is tapped. A tile
 *   promising 25% that opens onto a different board would be lying.
 *
 * Kept pure and separate from the tile for the same reason `picker-geometry.ts`
 * is separate from `piece-picker.tsx` — the arithmetic is worth testing without
 * a renderer.
 */
export function tileBadge(rows: readonly PuzzleProgressSummary[]): TileBadge | null {
  if (rows.some((row) => row.status === 'completed')) return { kind: 'completed' };

  const latest = rows[0];
  if (latest == null) return null;

  // An untouched board is not progress. `game-screen.tsx:278` refuses to persist
  // a 'not-started' session so this row should not exist, but a 0% badge on
  // every tile is a worse outcome than ignoring one that slipped through.
  if (latest.lockedPieces <= 0) return null;

  // Guarding the divisor rather than the result, the same way `PopProgress.tsx:20`
  // does: no badge beats a badge reading "NaN%".
  if (latest.totalPieces <= 0) return null;

  return {
    kind: 'progress',
    percent: Math.round((latest.lockedPieces / latest.totalPieces) * 100),
  };
}
