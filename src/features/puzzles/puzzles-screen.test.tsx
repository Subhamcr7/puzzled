import { fireEvent, render } from '@testing-library/react-native';

import { getProgressRepository, getWalletRepository, listCatalog } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';

import { PuzzlesScreen } from './puzzles-screen';

jest.mock('@/data', () => ({
  listCatalog: jest.fn(),
  getProgressRepository: jest.fn(),
  getWalletRepository: jest.fn(),
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

const bundled: PuzzleDefinition[] = [
  {
    id: 'first-light',
    title: 'First Light',
    image: { uri: '', pixelSize: { width: 1, height: 1 } },
    gridSize: 4,
    seed: 'a',
    revision: 1,
  },
  {
    id: 'playful-monkey',
    title: 'Playful Monkey',
    image: { uri: '', pixelSize: { width: 1, height: 1 } },
    gridSize: 4,
    seed: 'b',
    revision: 1,
  },
  {
    id: 'lazy-afternoon',
    title: 'Lazy Afternoon',
    image: { uri: '', pixelSize: { width: 1, height: 1 } },
    gridSize: 4,
    seed: 'c',
    revision: 1,
  },
];

const bundledTitles = bundled.map((p) => p.title);

async function renderScreen() {
  (listCatalog as jest.Mock).mockResolvedValue({ bundled, user: [] });
  (getProgressRepository as jest.Mock).mockResolvedValue({ listSummaries: async () => [] });
  (getWalletRepository as jest.Mock).mockResolvedValue({
    balance: async () => ({ coins: 500, hints: 5 }),
  });
  const rendered = render(<PuzzlesScreen />);
  await rendered.findAllByLabelText(/Puzzle image/);
  return rendered;
}

describe('PuzzlesScreen', () => {
  it('starts the gallery directly, with no Starter Pack banner', async () => {
    const { queryByText } = await renderScreen();
    expect(queryByText('Starter Pack')).toBeNull();
    expect(queryByText(/Every puzzle bundled with Puzzled/)).toBeNull();
  });

  it('shows no puzzle title in any visible text', async () => {
    const { queryByText } = await renderScreen();
    for (const title of bundledTitles) {
      expect(queryByText(title)).toBeNull();
    }
  });

  it('exposes no puzzle title through any accessibility label', async () => {
    const { queryByLabelText } = await renderScreen();
    for (const title of bundledTitles) {
      expect(queryByLabelText(new RegExp(title))).toBeNull();
    }
  });

  it('renders one image-only tile per puzzle', async () => {
    const { getAllByLabelText } = await renderScreen();
    expect(getAllByLabelText('Puzzle image. Double tap to select.')).toHaveLength(bundled.length);
  });

  it('opens the difficulty picker when a tile is tapped', async () => {
    const { getAllByLabelText } = await renderScreen();
    fireEvent.press(getAllByLabelText('Puzzle image. Double tap to select.')[0]);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/difficulty/[puzzleId]',
      params: { puzzleId: 'first-light' },
    });
  });
});
