import { fireEvent, render } from '@testing-library/react-native';

import { dateKey, getCompletionsRepository, getWalletRepository, listCatalog } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';

import { treasureRewardForStop } from './treasure';
import { TreasureScreen } from './treasure-screen';

jest.mock('react-native-svg', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    Svg: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    Line: () => <View />,
  };
});

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  listCatalog: jest.fn(),
  getCompletionsRepository: jest.fn(),
  getWalletRepository: jest.fn(),
  resolvePuzzleImageSource: jest.fn(() => 1),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack, dismissTo: jest.fn() }),
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

const pick: PuzzleDefinition[] = [
  {
    id: 'first-light',
    title: 'First Light',
    image: { uri: '', pixelSize: { width: 1, height: 1 } },
    gridSize: 4,
    seed: 'a',
    revision: 1,
  },
];

const recordOnce = jest.fn(async () => ({ coins: 330, hints: 0 }));

/** A completion of whatever puzzle the pool picks for a day (here always the same one). */
function completionOn(day: string) {
  return {
    puzzleId: 'first-light',
    gridSize: 4,
    elapsedMs: 60_000,
    completedAt: `${day}T12:00:00.000Z`,
  };
}

function dayKey(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function renderHunt(
  completions: { puzzleId: string; elapsedMs: number; completedAt: string }[],
) {
  (listCatalog as jest.Mock).mockResolvedValue({ bundled: pick, user: [] });
  (getCompletionsRepository as jest.Mock).mockResolvedValue({ list: async () => completions });
  (getWalletRepository as jest.Mock).mockResolvedValue({
    balance: async () => ({ coins: 300, hints: 0 }),
    recordOnce,
  });

  const rendered = render(<TreasureScreen />);
  // Data has landed once the live balance is shown (initial state is an em dash).
  await rendered.findByText('300');
  return rendered;
}

/** Give the map a real width so the node markers are placed (and queryable). */
function measureMap(rendered: ReturnType<typeof render>) {
  fireEvent(rendered.getByTestId('treasure-map'), 'layout', {
    nativeEvent: { layout: { width: 320, height: 405, x: 0, y: 160 } },
  });
}

describe('TreasureScreen map', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
    recordOnce.mockClear();
  });

  it('shows the day, stop count and difficulty tier in the header', async () => {
    const rendered = await renderHunt([completionOn(dayKey(-1))]);
    expect(rendered.getByText('Day 1 — stop 1 of 7 · Easy')).toBeTruthy();
    expect(
      rendered.getByText(
        `Finish today’s challenge to reach the next stop — ${treasureRewardForStop(2)} coins.`,
      ),
    ).toBeTruthy();
  });

  it('marks reached, current and locked stops, with the tier for each', async () => {
    const rendered = await renderHunt([completionOn(dayKey(0)), completionOn(dayKey(-1))]);
    measureMap(rendered);

    expect(rendered.getByText('Day 2 — stop 2 of 7 · Easy')).toBeTruthy();
    expect(rendered.getByLabelText('Stop 1 of 7, Easy difficulty, reached')).toBeTruthy();
    const current = rendered.getByLabelText('Stop 2 of 7, Easy difficulty, current level');
    expect(current.props.accessibilityRole).toBe('button');
    const locked = rendered.getByLabelText(
      `Stop 3 of 7, Medium difficulty, ${treasureRewardForStop(3)} coins, locked`,
    );
    expect(locked.props.accessibilityRole).toBe('text');
  });

  it('plays one tap and routes from a reached stop and the current stop', async () => {
    const rendered = await renderHunt([completionOn(dayKey(0)), completionOn(dayKey(-1))]);
    measureMap(rendered);

    fireEvent.press(rendered.getByLabelText('Stop 1 of 7, Easy difficulty, reached'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/puzzles');

    fireEvent.press(rendered.getByLabelText('Stop 2 of 7, Easy difficulty, current level'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/daily');
  });

  it('gives the locked chest its tier and reward without making it a button', async () => {
    const rendered = await renderHunt([completionOn(dayKey(0))]);
    measureMap(rendered);
    const chest = rendered.getByLabelText(
      `Stop 7 of 7, Hard difficulty, ${treasureRewardForStop(7)} coins, locked`,
    );
    expect(chest.props.accessibilityRole).toBe('text');
  });

  it('pays the reward once for the day that was finished, silently', async () => {
    const todayKey = dateKey(new Date());
    const rendered = await renderHunt([completionOn(dayKey(0)), completionOn(dayKey(-1))]);
    measureMap(rendered);
    expect(rendered.getByText('Day 2 — stop 2 of 7 · Easy')).toBeTruthy();
    expect(recordOnce).toHaveBeenCalledTimes(1);
    expect(recordOnce).toHaveBeenCalledWith({
      deltaCoins: treasureRewardForStop(2),
      deltaHints: 0,
      reason: 'treasure-stop',
      ref: todayKey,
    });
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });
});
