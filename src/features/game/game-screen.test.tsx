import { render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { GameScreen } from './game-screen';

const mockPuzzle = {
  id: 'first-light',
  title: 'First Light',
  image: { uri: '', pixelSize: { width: 1, height: 1 } },
  gridSize: 4,
  seed: 'seed',
  revision: 1,
};

const mockBack = jest.fn();

jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ back: mockBack, push: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@/data', () => ({
  getPuzzleById: jest.fn(async () => mockPuzzle),
  resolvePuzzleImageSource: jest.fn(() => 1),
  getProgressRepository: jest.fn(async () => ({
    getSession: jest.fn(async () => null),
    saveSession: jest.fn(async () => {}),
    deleteSession: jest.fn(async () => {}),
  })),
  getSettingsRepository: jest.fn(async () => ({
    get: jest.fn(async () => ({ sound: true, music: true, haptics: true })),
    set: jest.fn(async () => {}),
  })),
  getCompletionsRepository: jest.fn(),
  getWalletRepository: jest.fn(),
  sessionStorageKey: jest.fn(() => 'local-first-light-4'),
  coinsForCompletion: jest.fn(() => 26),
}));

// `puzzle-board.tsx` instantiates @shopify/react-native-skia at module scope,
// which Jest cannot load, so stub the component out. The puzzle tray and
// scrollbar render *inside* `PuzzleBoard`, so a rendered board here covers all
// three — the regression this file guards sits *outside* it: the header rows,
// tool tray and the board shell must keep rendering together after header
// changes.
jest.mock('./puzzle-board', () => {
  const { View } = jest.requireActual('react-native');
  return {
    PuzzleBoard: () => <View testID="puzzle-board" />,
    boardTrayReserve: () => 0,
  };
});

// `expo-audio`'s native module cannot be required under Jest (its JS throws at
// import time), so board-audio is stubbed. Audio state is not what this file
// guards.
jest.mock('./board-audio', () => ({
  initBoardAudio: jest.fn(),
  playSfx: jest.fn(),
  setMusicEnabled: jest.fn(),
  setSfxEnabled: jest.fn(),
  pauseBoardAudio: jest.fn(),
}));

async function renderLoadedScreen() {
  const rendered = render(<GameScreen puzzleId="first-light" initialGridSize={4} />);
  await rendered.findByTestId('puzzle-board');
  return rendered;
}

describe('GameScreen layout after the header redesign (regression)', () => {
  it('renders Back, the four tools and the board shell together after loading', async () => {
    const rendered = await renderLoadedScreen();

    rendered.getByLabelText('Back');
    const tray = rendered.getByTestId('tool-tray');
    for (const label of ['Hint', 'Edges', 'Preview', 'Pause']) {
      expect(within(tray).getByLabelText(label)).toBeTruthy();
    }

    const shell = rendered.getByTestId('board-shell');
    expect(within(shell).getByTestId('puzzle-board')).toBeTruthy();
  });

  it('spans the tool tray full board width and spreads the four tools evenly', async () => {
    const rendered = await renderLoadedScreen();

    // The tray wrapper stretches to the play-area column — i.e. the same width
    // as the board shell — instead of floating as a narrow right-aligned pill.
    expect(
      StyleSheet.flatten(rendered.getByTestId('tool-tray').props.style),
    ).toMatchObject({ alignSelf: 'stretch' });

    // The four tools sit in one row, spread evenly across the bar.
    const row = rendered.getByTestId('game-header-tools');
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      flexDirection: 'row',
      justifyContent: 'space-between',
    });
  });

  it("keeps the board shell claiming the leftover column height (flex: 1) — the board's own viewport collapses without it", async () => {
    const rendered = await renderLoadedScreen();
    const shell = rendered.getByTestId('board-shell');

    // `flex: 1` is the layout contract that makes the board fit at all: the
    // canvas measures its own viewport, so a shell that sizes itself from its
    // content never grows past `minHeight` and the board/tray/scrollbar
    // collapse out of view (seen on-device after commit 215c4ef).
    expect(StyleSheet.flatten(shell.props.style)).toMatchObject({
      flex: 1,
      minHeight: 220,
      overflow: 'hidden',
    });
  });
});
