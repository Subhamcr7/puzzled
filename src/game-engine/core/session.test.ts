import { generatePuzzlePieces } from './generate';
import { createInitialPositions } from './layout';
import {
  countLockedPieces,
  createInitialSession,
  dropPiece,
  isSessionComplete,
  isSessionCompatible,
  isSessionRestorable,
  isWithinSnapDistance,
  raisePiece,
  snapThresholdForCellSize,
} from './session';
import type { GameSession, PuzzleDefinition } from './types';

const puzzle: PuzzleDefinition = {
  id: 'first-light',
  title: 'First Light',
  image: {
    uri: 'asset://first-light',
    pixelSize: { width: 1200, height: 1200 },
  },
  gridSize: 8,
  seed: 'first-light-v1',
  revision: 1,
};

describe('game session primitives', () => {
  const generated = generatePuzzlePieces({ puzzle, cellSize: 50 });
  const initialPositions = createInitialPositions({
    pieces: generated.pieces,
    boardSize: generated.boardSize,
    mode: 'tray',
    seed: puzzle.seed,
  });

  it('creates a serializable local-first session', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });

    expect(session.pieces).toHaveLength(64);
    expect(session.status).toBe('not-started');
    expect(session.syncState).toBe('local');
    expect(countLockedPieces(session)).toBe(0);
    expect(session.pieces[0].position).toEqual(initialPositions['0:0']);
  });

  it('includes the exact boundary in the snap distance', () => {
    expect(isWithinSnapDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, 5)).toBe(true);
    expect(isWithinSnapDistance({ x: 3, y: 4.01 }, { x: 0, y: 0 }, 5)).toBe(false);
  });

  it('rejects a negative snap threshold', () => {
    expect(() => isWithinSnapDistance({ x: 0, y: 0 }, { x: 0, y: 0 }, -1)).toThrow(RangeError);
  });

  it('raises unlocked pieces above the current max z-index', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });

    const raised = raisePiece(session, '1:1', '2026-07-20T00:00:01.000Z');
    const maxZ = Math.max(...raised.pieces.map((piece) => piece.zIndex));
    expect(raised.pieces.find((piece) => piece.pieceId === '1:1')?.zIndex).toBe(maxZ);
  });

  it('snaps and locks a piece inside the threshold', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });
    const geometry = generated.pieces[0];
    const threshold = snapThresholdForCellSize(50);

    const next = dropPiece({
      session,
      pieceId: geometry.id,
      position: { x: geometry.solvedPosition.x + threshold / 2, y: geometry.solvedPosition.y },
      solvedPosition: geometry.solvedPosition,
      now: '2026-07-20T00:00:02.000Z',
      elapsedMs: 2000,
      snapThreshold: threshold,
    });

    const piece = next.pieces.find((entry) => entry.pieceId === geometry.id);
    expect(piece?.isLocked).toBe(true);
    expect(piece?.position).toEqual(geometry.solvedPosition);
    expect(next.status).toBe('in-progress');
    expect(next.elapsedMs).toBe(2000);
  });

  it('keeps a far drop unlocked at the released position', () => {
    const session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });
    const geometry = generated.pieces[0];
    const dropAt = { x: 300, y: 300 };

    const next = dropPiece({
      session,
      pieceId: geometry.id,
      position: dropAt,
      solvedPosition: geometry.solvedPosition,
      now: '2026-07-20T00:00:03.000Z',
      elapsedMs: 3000,
      snapThreshold: snapThresholdForCellSize(50),
    });

    const piece = next.pieces.find((entry) => entry.pieceId === geometry.id);
    expect(piece?.isLocked).toBe(false);
    expect(piece?.position).toEqual(dropAt);
    expect(isSessionComplete(next)).toBe(false);
  });

  it('marks the session completed when the final piece locks', () => {
    let session = createInitialSession({
      sessionId: 'session-1',
      puzzle,
      pieces: generated.pieces,
      initialPositions,
      now: '2026-07-20T00:00:00.000Z',
    });

    const threshold = snapThresholdForCellSize(50);

    for (const geometry of generated.pieces) {
      session = dropPiece({
        session,
        pieceId: geometry.id,
        position: geometry.solvedPosition,
        solvedPosition: geometry.solvedPosition,
        now: '2026-07-20T00:10:00.000Z',
        elapsedMs: 600_000,
        snapThreshold: threshold,
      });
    }

    expect(isSessionComplete(session)).toBe(true);
    expect(session.status).toBe('completed');
    expect(session.completedAt).toBe('2026-07-20T00:10:00.000Z');
    expect(countLockedPieces(session)).toBe(64);
  });

  describe('isSessionRestorable', () => {
    const fresh = () =>
      createInitialSession({
        sessionId: 'session-1',
        puzzle,
        pieces: generated.pieces,
        initialPositions,
        now: '2026-07-20T00:00:00.000Z',
      });

    it('restores an unfinished session for the same board', () => {
      const session = fresh();
      expect(isSessionRestorable(session, puzzle, generated.pieces)).toBe(true);
    });

    it('refuses a completed session even though it is compatible', () => {
      // The whole bug: a solved session matches the board it was solved on, so the
      // compatibility check passed and the player was dropped onto a finished
      // puzzle, which handed straight back to results. "Play Again" was unusable.
      const solved = { ...fresh(), status: 'completed' as const };
      expect(isSessionCompatible(solved, puzzle, generated.pieces)).toBe(true);
      expect(isSessionRestorable(solved, puzzle, generated.pieces)).toBe(false);
    });

    it('still refuses a session built for a different board', () => {
      const session = { ...fresh(), puzzleRevision: 99 };
      expect(isSessionRestorable(session, puzzle, generated.pieces)).toBe(false);
    });
  });

  describe('dropPiece evicts a loose piece covering a freshly locked slot', () => {
    const BOUNDS: Record<string, { width: number; height: number }> = {
      A: { width: 50, height: 50 },
      B: { width: 50, height: 50 },
      C: { width: 50, height: 50 },
      D: { width: 50, height: 50 },
    };
    const BOARD_HEIGHT = 200;
    const SOLVED = {
      A: { x: 0, y: 0 },
      B: { x: 100, y: 0 },
      C: { x: 100, y: 100 },
    };

    const fresh = (): GameSession => ({
      id: 'session-evict',
      puzzleId: 'first-light',
      puzzleRevision: 1,
      gridSize: 4,
      status: 'not-started',
      pieces: [
        { pieceId: 'A', position: { x: 0, y: 0 }, rotation: 0, isLocked: false, zIndex: 0 },
        { pieceId: 'B', position: { x: 100, y: 0 }, rotation: 0, isLocked: false, zIndex: 1 },
        { pieceId: 'C', position: { x: 100, y: 100 }, rotation: 0, isLocked: false, zIndex: 2 },
        { pieceId: 'D', position: { x: 150, y: 150 }, rotation: 0, isLocked: false, zIndex: 3 },
      ],
      startedAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      completedAt: null,
      elapsedMs: 0,
      syncState: 'local',
    });

    const withPosition = (
      session: GameSession,
      pieceId: string,
      position: { x: number; y: number },
    ) =>
      ({
        ...session,
        pieces: session.pieces.map((piece) =>
          piece.pieceId === pieceId ? { ...piece, position } : piece,
        ),
      }) as GameSession;

    const dropNear = (session: GameSession, pieceId: string) =>
      dropPiece({
        session,
        pieceId,
        position: SOLVED[pieceId as keyof typeof SOLVED],
        solvedPosition: SOLVED[pieceId as keyof typeof SOLVED],
        now: '2026-09-15T00:00:01.000Z',
        elapsedMs: 1000,
        snapThreshold: 5,
        boundsById: BOUNDS,
        boardHeight: BOARD_HEIGHT,
      });

    it('evicts the covering loose piece from a corner slot to the tray', () => {
      // B mis-dropped over A's corner slot (0..50, 0..50).
      const session = withPosition(fresh(), 'B', { x: 10, y: 5 });
      const next = dropNear(session, 'A');

      const piece = next.pieces.find((entry) => entry.pieceId === 'A');
      expect(piece?.isLocked).toBe(true);
      expect(piece?.position).toEqual({ x: 0, y: 0 });

      const covering = next.pieces.find((entry) => entry.pieceId === 'B');
      expect(covering?.isLocked).toBe(false);
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('evicts the covering loose piece from an edge slot to the tray', () => {
      // D mis-dropped over B's top-edge slot (100..150, 0..50).
      const session = withPosition(fresh(), 'D', { x: 105, y: 10 });
      const next = dropNear(session, 'B');

      const piece = next.pieces.find((entry) => entry.pieceId === 'B');
      expect(piece?.isLocked).toBe(true);

      const covering = next.pieces.find((entry) => entry.pieceId === 'D');
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('evicts the covering loose piece from a centre slot to the tray', () => {
      // A mis-dropped over C's centre slot (100..150, 100..150).
      const session = withPosition(fresh(), 'A', { x: 110, y: 110 });
      const next = dropNear(session, 'C');

      const piece = next.pieces.find((entry) => entry.pieceId === 'C');
      expect(piece?.isLocked).toBe(true);

      const covering = next.pieces.find((entry) => entry.pieceId === 'A');
      expect(covering?.isLocked).toBe(false);
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('leaves a loose piece that does not overlap the locked slot where it is', () => {
      // D rests at (150,150), clear of A's corner slot; it must not be touched.
      const next = dropNear(fresh(), 'A');

      const piece = next.pieces.find((entry) => entry.pieceId === 'A');
      expect(piece?.isLocked).toBe(true);

      const untouched = next.pieces.find((entry) => entry.pieceId === 'D');
      expect(untouched?.isLocked).toBe(false);
      expect(untouched?.position).toEqual({ x: 150, y: 150 });
    });

    it('evicts nothing when the drop does not snap', () => {
      const session = withPosition(fresh(), 'B', { x: 10, y: 5 });
      const next = dropPiece({
        session,
        pieceId: 'A',
        position: { x: 250, y: 250 },
        solvedPosition: SOLVED.A,
        now: '2026-09-15T00:00:01.000Z',
        elapsedMs: 1000,
        snapThreshold: 5,
        boundsById: BOUNDS,
        boardHeight: BOARD_HEIGHT,
      });

      expect(next.pieces.find((entry) => entry.pieceId === 'A')?.isLocked).toBe(false);
      expect(next.pieces.find((entry) => entry.pieceId === 'B')?.position).toEqual({ x: 10, y: 5 });
    });

    it('does not evict a locked piece, even one adjacent to the locked slot', () => {
      let session = fresh();
      session = dropNear(session, 'B');
      // D lies loose over A's slot; B is locked at its own slot beside it.
      session = withPosition(session, 'D', { x: 10, y: 5 });

      const next = dropNear(session, 'A');

      expect(next.pieces.find((entry) => entry.pieceId === 'A')?.isLocked).toBe(true);
      expect(next.pieces.find((entry) => entry.pieceId === 'B')?.isLocked).toBe(true);
      expect(next.pieces.find((entry) => entry.pieceId === 'B')?.position).toEqual({
        x: 100,
        y: 0,
      });
    });
  });
});
