import { fireEvent, render } from '@testing-library/react-native';

import { getPuzzleById, getProgressRepository, coinsForCompletion } from '@/data';
import { SUPPORTED_GRID_SIZES, type GridSize, type PuzzleDefinition } from '@/game-engine';

import { offsetForIndex, pickerGeometry } from './picker-geometry';
import { DifficultyScreen } from './difficulty-screen';

jest.mock('@/data', () => ({
  coinsForCompletion: jest.requireActual('@/data/local/wallet-repository').coinsForCompletion,
  getPuzzleById: jest.fn(),
  getProgressRepository: jest.fn(),
  resolvePuzzleImageSource: jest.fn(() => 1),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const puzzle: PuzzleDefinition = {
  id: 'lazy-afternoon',
  title: 'Lazy Afternoon',
  image: { uri: '', pixelSize: { width: 1, height: 1 } },
  gridSize: 6,
  seed: 'c',
  revision: 1,
};

function tierFor(size: GridSize): string {
  if (size <= 4) return 'Easy';
  if (size <= 7) return 'Medium';
  return 'Hard';
}

async function renderScreen() {
  (getPuzzleById as jest.Mock).mockResolvedValue(puzzle);
  (getProgressRepository as jest.Mock).mockResolvedValue({
    listSummaries: async () => [],
  });
  const rendered = render(<DifficultyScreen puzzleId="lazy-afternoon" />);
  await rendered.findByText('Reward:');
  return rendered;
}

describe('DifficultyScreen', () => {
  it('shows a clean image preview with no jigsaw/SVG overlay', async () => {
    const rendered = await renderScreen();
    expect(rendered.getByTestId('difficulty-preview-image')).toBeTruthy();
    const json = JSON.stringify(rendered.toJSON());
    expect(json).not.toContain('Path');
    expect(json).not.toContain('Svg');
  });

  it('shows no puzzle title anywhere on screen', async () => {
    const rendered = await renderScreen();
    expect(rendered.queryByText('Lazy Afternoon')).toBeNull();
    expect(rendered.queryByLabelText('Lazy Afternoon')).toBeNull();
  });

  it('shows the real reward for the selected size in a coin pill', async () => {
    const rendered = await renderScreen();
    // The screen opens on the most recent/definition size: 6x6.
    expect(rendered.getByText('46')).toBeTruthy();
    expect(rendered.getByLabelText(`Reward: ${coinsForCompletion(6)} coins`)).toBeTruthy();
    // Pinned to the real calculation so a drift never looks like the UI.
    expect(coinsForCompletion(6)).toBe(46);
  });

  it('updates the reward as the carousel selection changes', async () => {
    const rendered = await renderScreen();
    const strip = rendered.getByTestId('piece-picker');
    fireEvent(strip, 'layout', { nativeEvent: { layout: { width: 393, height: 140 } } });
    const geometry = pickerGeometry(393);
    fireEvent(strip, 'scroll', {
      nativeEvent: { contentOffset: { x: offsetForIndex(2, geometry) } },
    });
    // Index 2 in SUPPORTED_GRID_SIZES is 5, a 5x5 = 25 pieces.
    expect(SUPPORTED_GRID_SIZES[2]).toBe(5);
    expect(rendered.getByText(String(coinsForCompletion(5)))).toBeTruthy();
  });

  it('keeps every supported piece count in the carousel', async () => {
    const rendered = await renderScreen();
    for (const size of SUPPORTED_GRID_SIZES) {
      expect(rendered.getByLabelText(`${size * size} pieces, ${tierFor(size)}`)).toBeTruthy();
    }
  });

  it('still offers Start Puzzle with no saved board', async () => {
    const rendered = await renderScreen();
    expect(rendered.getByText('Start Puzzle')).toBeTruthy();
  });
});
