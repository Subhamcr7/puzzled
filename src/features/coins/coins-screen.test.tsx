import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { dailyBonusFor, getWalletRepository } from '@/data';

import { CoinsScreen } from './coins-screen';

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  getWalletRepository: jest.fn(),
}));

const mockBack = jest.fn();
const mockDismissTo = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ back: mockBack, dismissTo: mockDismissTo, push: mockPush }),
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

const recordOnce = jest.fn(async () => ({}));
const walletMock = {
  balance: jest.fn(async () => ({ coins: 100, hints: 0 })),
  history: jest.fn(async () => []),
  recordOnce,
};

function renderCoins() {
  (getWalletRepository as jest.Mock).mockResolvedValue(walletMock);
  return render(<CoinsScreen />);
}

describe('CoinsScreen tap sounds', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
    recordOnce.mockClear();
  });

  it('renders the balance and earn rows without any tap sound', async () => {
    const rendered = renderCoins();
    await rendered.findByText('100');
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap and records a single daily claim', async () => {
    const rendered = renderCoins();
    await rendered.findByLabelText(`Claim ${dailyBonusFor(0)}`);
    fireEvent.press(rendered.getByLabelText(`Claim ${dailyBonusFor(0)}`));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(recordOnce).toHaveBeenCalledTimes(1));
    expect(recordOnce).toHaveBeenCalledWith({
      deltaCoins: dailyBonusFor(0),
      deltaHints: 0,
      reason: 'streak-bonus',
      ref: expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
    });
  });

  it('plays one tap on an earn-row Go button and routes', async () => {
    const rendered = renderCoins();
    await rendered.findByLabelText('Finish a puzzle');
    fireEvent.press(rendered.getByLabelText('Finish a puzzle'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).toHaveBeenCalledWith('/puzzles');

    fireEvent.press(rendered.getByLabelText("Today's challenge"));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenCalledWith('/daily');
  });

  it('plays one tap on the header back button', async () => {
    const rendered = renderCoins();
    await rendered.findByText('100');
    fireEvent.press(rendered.getByLabelText('Go back'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
