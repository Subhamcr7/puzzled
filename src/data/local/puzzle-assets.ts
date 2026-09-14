import type { PuzzleDefinition } from '@/game-engine';

/**
 * Static puzzle id → bundled image map.
 *
 * Metro can only resolve literal `require` calls at build time, so bundled art
 * cannot be looked up from `puzzle.image.uri` at runtime. Adding a puzzle means
 * one line here plus its catalog entry in `local-puzzle-repository`.
 */
const PUZZLE_IMAGE_MODULES: Record<string, number> = {
  'first-light': require('../../../assets/puzzles/first-light.png'),
  'playful-monkey': require('../../../assets/puzzles/playful-monkey.jpg'),
  'pond-friends': require('../../../assets/puzzles/pond-friends.jpg'),
  'frog-mugshot': require('../../../assets/puzzles/frog-mugshot.jpg'),
  'lazy-afternoon': require('../../../assets/puzzles/lazy-afternoon.jpg'),
  'painted-landscape': require('../../../assets/puzzles/jozefm84-painted-landscape-10246533_1280.png'),
  'de-vera': require('../../../assets/puzzles/kestner-brae-kb-de-vera-gKOe64kzJS0-unsplash.jpg'),
  'kevin-bowler': require('../../../assets/puzzles/kevin-bowler-uMMa63wQcBQ-unsplash.jpg'),
  'mb-tr': require('../../../assets/puzzles/m-b-Tr-faG4v38w-unsplash.jpg'),
  'toni-zaat': require('../../../assets/puzzles/toni-zaat-bl3yc0yqjzq-unsplash.jpg'),
};

export function getPuzzleImageModule(puzzleId: string): number | null {
  return PUZZLE_IMAGE_MODULES[puzzleId] ?? null;
}

/**
 * The image argument for Skia's `useImage`: a bundled `require` module id, or a
 * `file://` uri for an imported photo. Null when neither is available.
 *
 * Pure (no database), so it stays testable and import-cheap for the render path.
 */
export function resolvePuzzleImageSource(puzzle: PuzzleDefinition): number | string | null {
  const moduleId = getPuzzleImageModule(puzzle.id);
  if (moduleId != null) {
    return moduleId;
  }

  const { uri } = puzzle.image;
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  return null;
}

/** Bundled puzzles are read-only; only imported ones can be deleted. */
export function isUserPuzzle(puzzle: PuzzleDefinition): boolean {
  return getPuzzleImageModule(puzzle.id) == null && puzzle.image.uri.startsWith('file://');
}
