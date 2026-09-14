import { fireEvent, render } from '@testing-library/react-native';

import { ACHIEVEMENT_REWARD, getCompletionsRepository, getWalletRepository } from '@/data';

import { AchievementsScreen } from './achievements-screen';

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  getCompletionsRepository: jest.fn(),
  getWalletRepository: jest.fn(),
}));

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
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const recordOnce = jest.fn(async () => ({ coins: 100, hints: 0 }));

const completion = {
  puzzleId: 'first-light',
  gridSize: 4,
  elapsedMs: 120_000, // under 10 minutes: unlocks First Puzzle and Speed Master
  completedAt: '2026-09-01T12:00:00.000Z',
};

function renderAchievements(completions: unknown[] = []) {
  (getCompletionsRepository as jest.Mock).mockResolvedValue({ list: async () => completions });
  (getWalletRepository as jest.Mock).mockResolvedValue({ recordOnce });
  return render(<AchievementsScreen />);
}

describe('AchievementsScreen sounds and payout', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
    recordOnce.mockClear();
  });

  it('pays every unlocked achievement on sight, once each, with no tap', async () => {
    const rendered = renderAchievements([completion]);
    await rendered.findAllByText('Unlocked · 50 coins');
    expect(recordOnce).toHaveBeenCalledTimes(2);
    expect(recordOnce).toHaveBeenCalledWith({
      deltaCoins: ACHIEVEMENT_REWARD,
      deltaHints: 0,
      reason: 'achievement-unlock',
      ref: 'first-puzzle',
    });
    expect(recordOnce).toHaveBeenCalledWith({
      deltaCoins: ACHIEVEMENT_REWARD,
      deltaHints: 0,
      reason: 'achievement-unlock',
      ref: 'speed-master',
    });
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('renders fully locked rows silently', async () => {
    const rendered = renderAchievements();
    await rendered.findByText('First Puzzle');
    expect(recordOnce).not.toHaveBeenCalled();
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap on the header back button', async () => {
    const rendered = renderAchievements();
    await rendered.findByText('First Puzzle');
    fireEvent.press(rendered.getByLabelText('Go back'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
