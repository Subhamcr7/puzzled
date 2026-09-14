import { fireEvent, render } from '@testing-library/react-native';

import {
  getCompletionsRepository,
  getProgressRepository,
  getWalletRepository,
  listCatalog,
} from '@/data';

import { HomeScreen } from './home-screen';

jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  listCatalog: jest.fn(),
  getWalletRepository: jest.fn(),
  getProgressRepository: jest.fn(),
  getCompletionsRepository: jest.fn(),
  resolvePuzzleImageSource: jest.fn(() => 1),
}));

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
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

const puzzle = {
  id: 'first-light',
  title: 'First Light',
  image: { uri: '', pixelSize: { width: 1, height: 1 } },
  gridSize: 4,
  seed: 'a',
  revision: 1,
};

const summary = {
  puzzleId: 'first-light',
  gridSize: 4,
  status: 'in-progress' as const,
  lockedPieces: 4,
  totalPieces: 16,
  elapsedMs: 0,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

async function renderScreen({ summaryRows = [summary] } = {}) {
  (listCatalog as jest.Mock).mockResolvedValue({ bundled: [puzzle], user: [] });
  (getWalletRepository as jest.Mock).mockResolvedValue({
    balance: async () => ({ coins: 500, hints: 5 }),
    recordOnce: jest.fn(async () => ({ coins: 550, hints: 5 })),
  });
  (getProgressRepository as jest.Mock).mockResolvedValue({
    listSummaries: async () => summaryRows,
  });
  (getCompletionsRepository as jest.Mock).mockResolvedValue({ list: async () => [] });

  const rendered = render(<HomeScreen />);
  await rendered.findByText("Today's Challenge");
  return rendered;
}

describe('HomeScreen tap sounds', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
    mockPush.mockClear();
    mockNavigate.mockClear();
  });

  it('renders no sound from loading or data arriving', async () => {
    await renderScreen();
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap per press across the top bar, cards and links', async () => {
    const rendered = await renderScreen();

    fireEvent.press(rendered.getByLabelText('500 coins. Get more.'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/coins');

    fireEvent.press(rendered.getByLabelText('Settings'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/settings');

    fireEvent.press(rendered.getByLabelText('Play Now'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(3);
    expect(mockPush).toHaveBeenCalledWith('/daily');

    fireEvent.press(rendered.getByLabelText('Open the daily treasure hunt'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(4);
    expect(mockPush).toHaveBeenCalledWith('/treasure');

    fireEvent.press(rendered.getByLabelText('See every puzzle'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(5);
    expect(mockNavigate).toHaveBeenCalledWith('/puzzles');

    fireEvent.press(rendered.getByLabelText('Continue First Light, 25 percent done'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(6);

    fireEvent.press(rendered.getByLabelText('Daily Puzzle'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(7);

    fireEvent.press(rendered.getByLabelText('My Album'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(8);
    expect(mockNavigate).toHaveBeenCalledWith('/library');
  });

  it('resumes the most recent board from the primary button with one tap', async () => {
    const rendered = await renderScreen();
    fireEvent.press(rendered.getByLabelText('Continue'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game/[puzzleId]',
      params: { puzzleId: 'first-light', size: '4' },
    });
  });
});
