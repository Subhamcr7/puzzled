import type { GameSession, PieceGeometry, Point, PuzzleDefinition, Size } from './types';

import { DEFAULT_SNAP_THRESHOLD_RATIO } from './constants';

interface CreateSessionInput {
  sessionId: string;
  puzzle: PuzzleDefinition;
  pieces: PieceGeometry[];
  initialPositions: Readonly<Record<string, Point>>;
  now: string;
}

export function createInitialSession({
  sessionId,
  puzzle,
  pieces,
  initialPositions,
  now,
}: CreateSessionInput): GameSession {
  return {
    id: sessionId,
    puzzleId: puzzle.id,
    puzzleRevision: puzzle.revision,
    gridSize: puzzle.gridSize,
    status: 'not-started',
    pieces: pieces.map((piece, zIndex) => ({
      pieceId: piece.id,
      position: initialPositions[piece.id] ?? piece.solvedPosition,
      rotation: 0,
      isLocked: false,
      zIndex,
    })),
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    elapsedMs: 0,
    syncState: 'local',
  };
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isWithinSnapDistance(
  currentPosition: Point,
  solvedPosition: Point,
  threshold: number,
): boolean {
  if (threshold < 0) {
    throw new RangeError('Snap threshold must be non-negative.');
  }

  return distanceBetween(currentPosition, solvedPosition) <= threshold;
}

export function countLockedPieces(session: GameSession): number {
  return session.pieces.reduce((count, piece) => count + Number(piece.isLocked), 0);
}

export function isSessionComplete(session: GameSession): boolean {
  return session.pieces.length > 0 && countLockedPieces(session) === session.pieces.length;
}

function requirePieceIndex(session: GameSession, pieceId: string): number {
  const index = session.pieces.findIndex((piece) => piece.pieceId === pieceId);
  if (index < 0) {
    throw new Error(`Unknown piece: ${pieceId}`);
  }
  return index;
}

function withUpdatedPiece(
  session: GameSession,
  pieceId: string,
  updater: (piece: GameSession['pieces'][number]) => GameSession['pieces'][number],
  now: string,
  elapsedMs: number,
): GameSession {
  const index = requirePieceIndex(session, pieceId);
  const pieces = session.pieces.map((piece, pieceIndex) =>
    pieceIndex === index ? updater(piece) : piece,
  );

  return buildNextSession(session, pieces, now, elapsedMs);
}

/** Stamp a concrete piece state into the session and roll status/completion forward. */
function buildNextSession(
  session: GameSession,
  pieces: GameSession['pieces'],
  now: string,
  elapsedMs: number,
): GameSession {
  const next: GameSession = {
    ...session,
    pieces,
    updatedAt: now,
    elapsedMs,
    syncState: session.syncState === 'synced' ? 'pending' : session.syncState,
  };

  if (session.status === 'not-started') {
    next.status = 'in-progress';
  }

  if (isSessionComplete(next)) {
    next.status = 'completed';
    next.completedAt = now;
  }

  return next;
}

/** Bring an unlocked piece to the top of the z-order for dragging. */
export function raisePiece(session: GameSession, pieceId: string, now: string): GameSession {
  const index = requirePieceIndex(session, pieceId);
  const target = session.pieces[index];

  if (target.isLocked) {
    return session;
  }

  const maxZ = session.pieces.reduce((max, piece) => Math.max(max, piece.zIndex), 0);

  return withUpdatedPiece(
    session,
    pieceId,
    (piece) => ({ ...piece, zIndex: maxZ + 1 }),
    now,
    session.elapsedMs,
  );
}

export interface DropPieceInput {
  session: GameSession;
  pieceId: string;
  position: Point;
  solvedPosition: Point;
  now: string;
  elapsedMs: number;
  /** Absolute snap distance in board units. */
  snapThreshold: number;
  /**
   * Axis-aligned silhouette size (board units) per piece. When a piece locks, any
   * still-loose piece whose bounds overlap the freshly locked slot is sent back to
   * the tray — a mis-drop parked over a slot must not keep the correct piece from
   * latching there. Absent, solving behaves exactly as before (no eviction).
   */
  boundsById?: Readonly<Record<string, Size>>;
  /**
   * Board height in board units. A piece overlapping a freshly locked slot is
   * parked at `y = boardHeight` (the same boundary a board-piece dropped on the
   * tray is parked on) so it returns to the tray.
   */
  boardHeight?: number;
}

/** Whether two axis-aligned boxes overlap with positive area (touching edges don't count). */
function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Commit a drag end. Snaps and locks when within threshold; otherwise keeps the drop position.
 */
export function dropPiece({
  session,
  pieceId,
  position,
  solvedPosition,
  now,
  elapsedMs,
  snapThreshold,
  boundsById,
  boardHeight,
}: DropPieceInput): GameSession {
  const index = requirePieceIndex(session, pieceId);
  if (session.pieces[index].isLocked) {
    return session;
  }

  const shouldSnap = isWithinSnapDistance(position, solvedPosition, snapThreshold);
  const lockedBounds = boundsById?.[pieceId];

  const pieces = session.pieces.map((piece, pieceIndex) => {
    if (pieceIndex === index) {
      return {
        ...piece,
        position: shouldSnap ? { ...solvedPosition } : { ...position },
        isLocked: shouldSnap,
        rotation: 0,
      };
    }

    if (!shouldSnap || piece.isLocked || boardHeight == null || !lockedBounds) {
      return piece;
    }

    const bounds = boundsById[piece.pieceId];
    if (!bounds) {
      return piece;
    }

    const overlaps =
      boxesIntersect(
        { x: piece.position.x, y: piece.position.y, width: bounds.width, height: bounds.height },
        {
          x: solvedPosition.x,
          y: solvedPosition.y,
          width: lockedBounds.width,
          height: lockedBounds.height,
        },
      ) && piece.position.y < boardHeight;

    return overlaps ? { ...piece, position: { x: 0, y: boardHeight } } : piece;
  });

  return buildNextSession(session, pieces, now, elapsedMs);
}

export function snapThresholdForCellSize(
  cellSize: number,
  ratio: number = DEFAULT_SNAP_THRESHOLD_RATIO,
): number {
  if (cellSize <= 0) {
    throw new RangeError('cellSize must be positive.');
  }
  if (ratio < 0) {
    throw new RangeError('Snap ratio must be non-negative.');
  }
  return cellSize * ratio;
}

/**
 * A restored session is only safe to resume if it describes the same board the
 * generator just produced. Revision bumps, grid changes, or a new generator
 * algorithm all invalidate stored piece positions.
 */
export function isSessionCompatible(
  session: GameSession,
  puzzle: PuzzleDefinition,
  pieces: readonly PieceGeometry[],
): boolean {
  if (
    session.puzzleId !== puzzle.id ||
    session.puzzleRevision !== puzzle.revision ||
    session.gridSize !== puzzle.gridSize ||
    session.pieces.length !== pieces.length
  ) {
    return false;
  }

  const knownIds = new Set(pieces.map((piece) => piece.id));
  return session.pieces.every((piece) => knownIds.has(piece.pieceId));
}

/**
 * Whether a stored session should be put back on the board.
 *
 * Compatibility is necessary but not sufficient: a **completed** session is
 * compatible with the board it was solved on, and restoring one dropped the player
 * onto a finished puzzle. The completion effect keys off `status === 'completed'`, so
 * it then handed straight off to the results screen — "Play Again" bounced results →
 * game → results and no finished puzzle could be replayed from any entry point.
 *
 * Replaying a finished puzzle means starting it over, so a completed session is
 * deliberately dropped in favour of a fresh board.
 */
export function isSessionRestorable(
  session: GameSession,
  puzzle: PuzzleDefinition,
  pieces: readonly PieceGeometry[],
): boolean {
  return session.status !== 'completed' && isSessionCompatible(session, puzzle, pieces);
}

export function findGeometry(pieces: readonly PieceGeometry[], pieceId: string): PieceGeometry {
  const geometry = pieces.find((piece) => piece.id === pieceId);
  if (!geometry) {
    throw new Error(`Unknown geometry: ${pieceId}`);
  }
  return geometry;
}
