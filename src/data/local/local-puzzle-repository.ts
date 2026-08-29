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
