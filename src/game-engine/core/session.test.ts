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
      E: { width: 50, height: 50 },
    };
    const BOARD_HEIGHT = 200;
    const SOLVED = {
      A: { x: 0, y: 0 },
      B: { x: 150, y: 0 },
      C: { x: 0, y: 150 },
      D: { x: 150, y: 150 },
      E: { x: 75, y: 75 },
    };

    const fresh = (): GameSession => ({
      id: 'session-evict',
      puzzleId: 'first-light',
      puzzleRevision: 1,
      gridSize: 4,
      status: 'not-started',
      pieces: [
        { pieceId: 'A', position: { ...SOLVED.A }, rotation: 0, isLocked: false, zIndex: 0 },
        { pieceId: 'B', position: { ...SOLVED.B }, rotation: 0, isLocked: false, zIndex: 1 },
        { pieceId: 'C', position: { ...SOLVED.C }, rotation: 0, isLocked: false, zIndex: 2 },
        { pieceId: 'D', position: { ...SOLVED.D }, rotation: 0, isLocked: false, zIndex: 3 },
        { pieceId: 'E', position: { ...SOLVED.E }, rotation: 0, isLocked: false, zIndex: 4 },
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

    it('evicts covering loose piece from top-left corner to tray', () => {
      const session = withPosition(fresh(), 'E', { x: 10, y: 5 });
      const next = dropNear(session, 'A');

      expect(next.pieces.find((p) => p.pieceId === 'A')?.isLocked).toBe(true);
      expect(next.pieces.find((p) => p.pieceId === 'A')?.position).toEqual({ x: 0, y: 0 });

      const covering = next.pieces.find((p) => p.pieceId === 'E');
      expect(covering?.isLocked).toBe(false);
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('evicts covering loose piece from top-right corner to tray', () => {
      const session = withPosition(fresh(), 'E', { x: 155, y: 5 });
      const next = dropNear(session, 'B');

      expect(next.pieces.find((p) => p.pieceId === 'B')?.isLocked).toBe(true);
      expect(next.pieces.find((p) => p.pieceId === 'B')?.position).toEqual({ x: 150, y: 0 });

      const covering = next.pieces.find((p) => p.pieceId === 'E');
      expect(covering?.isLocked).toBe(false);
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('evicts covering loose piece from bottom-left corner to tray', () => {
      const session = withPosition(fresh(), 'E', { x: 10, y: 155 });
      const next = dropNear(session, 'C');

      expect(next.pieces.find((p) => p.pieceId === 'C')?.isLocked).toBe(true);
      expect(next.pieces.find((p) => p.pieceId === 'C')?.position).toEqual({ x: 0, y: 150 });

      const covering = next.pieces.find((p) => p.pieceId === 'E');
      expect(covering?.isLocked).toBe(false);
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('evicts covering loose piece from bottom-right corner to tray', () => {
      const session = withPosition(fresh(), 'E', { x: 155, y: 155 });
      const next = dropNear(session, 'D');

      expect(next.pieces.find((p) => p.pieceId === 'D')?.isLocked).toBe(true);
      expect(next.pieces.find((p) => p.pieceId === 'D')?.position).toEqual({ x: 150, y: 150 });

      const covering = next.pieces.find((p) => p.pieceId === 'E');
      expect(covering?.isLocked).toBe(false);
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('evicts covering loose piece from centre (non-corner) slot to tray', () => {
      const session = withPosition(fresh(), 'C', { x: 80, y: 80 });
      const next = dropNear(session, 'E');

      expect(next.pieces.find((p) => p.pieceId === 'E')?.isLocked).toBe(true);
      expect(next.pieces.find((p) => p.pieceId === 'E')?.position).toEqual({ x: 75, y: 75 });

      const covering = next.pieces.find((p) => p.pieceId === 'C');
      expect(covering?.isLocked).toBe(false);
      expect(covering?.position).toEqual({ x: 0, y: BOARD_HEIGHT });
    });

    it('leaves loose pieces that do not overlap the locked slot untouched', () => {
      const next = dropNear(fresh(), 'A');

      expect(next.pieces.find((p) => p.pieceId === 'A')?.isLocked).toBe(true);
      for (const id of ['B', 'C', 'D', 'E']) {
        const piece = next.pieces.find((p) => p.pieceId === id);
        expect(piece?.isLocked).toBe(false);
        expect(piece?.position).toEqual(SOLVED[id as keyof typeof SOLVED]);
      }
    });

    it('evicts nothing when the drop does not snap', () => {
      const session = withPosition(fresh(), 'E', { x: 10, y: 5 });
      const next = dropPiece({
        session,
        pieceId: 'A',
        position: { x: 180, y: 180 },
        solvedPosition: SOLVED.A,
        now: '2026-09-15T00:00:01.000Z',
        elapsedMs: 1000,
        snapThreshold: 5,
        boundsById: BOUNDS,
        boardHeight: BOARD_HEIGHT,
      });

      expect(next.pieces.find((p) => p.pieceId === 'A')?.isLocked).toBe(false);
      expect(next.pieces.find((p) => p.pieceId === 'E')?.position).toEqual({ x: 10, y: 5 });
    });

    it('does not evict a locked piece, even one adjacent to the locked slot', () => {
      let session = fresh();
      session = dropNear(session, 'B');
      session = withPosition(session, 'E', { x: 10, y: 5 });

      const next = dropNear(session, 'A');

      expect(next.pieces.find((p) => p.pieceId === 'A')?.isLocked).toBe(true);
      expect(next.pieces.find((p) => p.pieceId === 'B')?.isLocked).toBe(true);
      expect(next.pieces.find((p) => p.pieceId === 'B')?.position).toEqual({ x: 150, y: 0 });
    });

    it('snap is the single lock event: re-dropping a locked piece changes nothing', () => {
      let session = dropNear(fresh(), 'A');
      session = dropNear(session, 'A');

      const piece = session.pieces.find((p) => p.pieceId === 'A');
      expect(piece?.isLocked).toBe(true);
      expect(piece?.position).toEqual({ x: 0, y: 0 });
    });
  });
});
