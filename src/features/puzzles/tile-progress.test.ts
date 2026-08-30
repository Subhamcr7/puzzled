import { type PuzzleProgressSummary } from '@/data';

import { tileBadge } from './tile-progress';

function summary(overrides: Partial<PuzzleProgressSummary> = {}): PuzzleProgressSummary {
  return {
    puzzleId: 'first-light',
    gridSize: 4,
    status: 'in-progress',
    lockedPieces: 8,
    totalPieces: 16,
    elapsedMs: 0,
    updatedAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * The grid tile shows at most one badge over the artwork, so the decision of
 * *which* has to be a single pure function rather than a chain of ternaries
 * inside JSX. The percent formula lived copy-pasted in three screens
 * (`home-screen.tsx:111`, `library-screen.tsx:448`, `statistics-screen.tsx:88`);
 * this is the one place it is tested.
 */
describe('tileBadge', () => {
  it('shows nothing for a puzzle that was never opened', () => {
    expect(tileBadge([])).toBeNull();
  });

  it('reports a started board as a rounded percentage', () => {
    expect(tileBadge([summary({ lockedPieces: 8, totalPieces: 16 })])).toEqual({
      kind: 'progress',
      percent: 50,
    });
  });

  it('rounds rather than truncates', () => {
    // 1/3 = 33.33% and 2/3 = 66.67% — the pair that catches a floor().
    expect(tileBadge([summary({ lockedPieces: 3, totalPieces: 9 })])).toEqual({
      kind: 'progress',
      percent: 33,
    });
    expect(tileBadge([summary({ lockedPieces: 6, totalPieces: 9 })])).toEqual({
      kind: 'progress',
      percent: 67,
    });
  });

  it('marks a finished board as completed rather than 100%', () => {
    expect(
      tileBadge([summary({ status: 'completed', lockedPieces: 16, totalPieces: 16 })]),
    ).toEqual({ kind: 'completed' });
  });

  it('treats an untouched board as no progress, not 0%', () => {
    // `game-screen.tsx:278` skips persistence while a session is 'not-started',
    // so this row should not exist — but a 0% badge on every tile is a worse
    // failure than ignoring one.
    expect(tileBadge([summary({ status: 'not-started', lockedPieces: 0 })])).toBeNull();
  });

  it('never divides by zero', () => {
    // Same guard as `PopProgress.tsx:20`: no badge beats a NaN% badge.
    expect(tileBadge([summary({ lockedPieces: 0, totalPieces: 0 })])).toBeNull();
    expect(tileBadge([summary({ lockedPieces: 4, totalPieces: 0 })])).toBeNull();
  });

  it('prefers a completed board over a half-built one of another size', () => {
    // Boards are stored per (puzzle, size), so one image can have several rows.
    // Finishing the image is the stronger statement, whichever size did it, and
    // it does not depend on row order.
    const rows = [
      summary({ gridSize: 6, lockedPieces: 4, totalPieces: 36 }),
      summary({ gridSize: 4, status: 'completed' }),
    ];
    expect(tileBadge(rows)).toEqual({ kind: 'completed' });
    expect(tileBadge([...rows].reverse())).toEqual({ kind: 'completed' });
  });

  it('uses the most recently played board when several are in progress', () => {
    // `listSummaries()` orders by `updated_at DESC`, so index 0 is the board the
    // player would land on from Select Difficulty — the percentage must agree
    // with the one that screen preselects (`difficulty-screen.tsx:57`).
    const rows = [
      summary({
        gridSize: 10,
        lockedPieces: 25,
        totalPieces: 100,
        updatedAt: '2026-08-29T10:00:00.000Z',
      }),
      summary({
        gridSize: 4,
        lockedPieces: 12,
        totalPieces: 16,
        updatedAt: '2026-08-28T10:00:00.000Z',
      }),
    ];
    expect(tileBadge(rows)).toEqual({ kind: 'progress', percent: 25 });
  });
});
