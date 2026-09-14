import type { PuzzleDefinition } from '@/game-engine';

import type { PuzzleRepository } from '../repositories';

const bundledPuzzles: PuzzleDefinition[] = [
  {
    id: 'first-light',
    title: 'First Light',
    image: {
      uri: 'asset://puzzles/first-light',
      pixelSize: { width: 1024, height: 1024 },
    },
    // 4×4 starter so drag/snap feel can be judged on a phone before 8–10 boards.
    gridSize: 4,
    seed: 'first-light-v1',
    revision: 1,
  },
  {
    id: 'playful-monkey',
    title: 'Playful Monkey',
    image: {
      uri: 'asset://puzzles/playful-monkey',
      pixelSize: { width: 736, height: 760 },
    },
    gridSize: 4,
    seed: 'playful-monkey-v1',
    revision: 1,
  },
  {
    id: 'pond-friends',
    title: 'Pond Friends',
    image: {
      uri: 'asset://puzzles/pond-friends',
      pixelSize: { width: 736, height: 736 },
    },
    gridSize: 4,
    seed: 'pond-friends-v1',
    revision: 1,
  },
  {
    id: 'frog-mugshot',
    title: 'Frog Mugshot',
    image: {
      uri: 'asset://puzzles/frog-mugshot',
      pixelSize: { width: 736, height: 736 },
    },
    gridSize: 4,
    seed: 'frog-mugshot-v1',
    revision: 1,
  },
  {
    id: 'lazy-afternoon',
    title: 'Lazy Afternoon',
    image: {
      uri: 'asset://puzzles/lazy-afternoon',
      pixelSize: { width: 736, height: 736 },
    },
    gridSize: 4,
    seed: 'lazy-afternoon-v1',
    revision: 1,
  },

  // Journey art pack: five player-supplied images. Titles are best-effort source
  // metadata (model cannot read the pictures); rename freely.
  {
    id: 'painted-landscape',
    title: 'Painted Landscape',
    image: {
      uri: 'asset://puzzles/painted-landscape',
      pixelSize: { width: 1280, height: 1004 },
    },
    gridSize: 4,
    seed: 'painted-landscape-v1',
    revision: 1,
  },
  {
    id: 'de-vera',
    title: 'De Vera',
    image: {
      uri: 'asset://puzzles/de-vera',
      pixelSize: { width: 3130, height: 2075 },
    },
    gridSize: 4,
    seed: 'de-vera-v1',
    revision: 1,
  },
  {
    id: 'kevin-bowler',
    title: 'Kevin Bowler',
    image: {
      uri: 'asset://puzzles/kevin-bowler',
      pixelSize: { width: 1920, height: 1080 },
    },
    gridSize: 4,
    seed: 'kevin-bowler-v1',
    revision: 1,
  },
  {
    id: 'mb-tr',
    title: 'M.B.',
    image: {
      uri: 'asset://puzzles/mb-tr',
      pixelSize: { width: 1920, height: 960 },
    },
    gridSize: 4,
    seed: 'mb-tr-v1',
    revision: 1,
  },
  {
    id: 'toni-zaat',
    title: 'Toni Zaat',
    image: {
      uri: 'asset://puzzles/toni-zaat',
      pixelSize: { width: 1920, height: 1280 },
    },
    gridSize: 4,
    seed: 'toni-zaat-v1',
    revision: 1,
  },
];

function clonePuzzle(puzzle: PuzzleDefinition): PuzzleDefinition {
  return {
    ...puzzle,
    image: {
      ...puzzle.image,
      pixelSize: { ...puzzle.image.pixelSize },
    },
  };
}

export class LocalPuzzleRepository implements PuzzleRepository {
  async list(): Promise<PuzzleDefinition[]> {
    return bundledPuzzles.map(clonePuzzle);
  }

  async getById(puzzleId: string): Promise<PuzzleDefinition | null> {
    const puzzle = bundledPuzzles.find((candidate) => candidate.id === puzzleId);
    return puzzle ? clonePuzzle(puzzle) : null;
  }
}
