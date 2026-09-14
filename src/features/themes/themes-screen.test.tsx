import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { getWalletRepository } from '@/data';

import { ThemesScreen } from './themes-screen';

jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

const mockSetThemeId = jest.fn();
jest.mock('@/shared/theme-context', () => {
  const { MEADOW } = jest.requireActual('@/shared/themes');
  return {
    useTheme: () => MEADOW,
    useThemeControl: () => ({ theme: MEADOW, setThemeId: mockSetThemeId, ready: true }),
  };
});

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
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

const recordOnce = jest.fn(async () => ({}));
const walletMock = {
  balance: jest.fn(async () => ({ coins: 600, hints: 0 })),
  history: jest.fn(async () => []),
  recordOnce,
};

function renderThemes() {
  (getWalletRepository as jest.Mock).mockResolvedValue(walletMock);
  return render(<ThemesScreen />);
}

describe('ThemesScreen sounds and purchase', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
    recordOnce.mockClear();
    mockSetThemeId.mockClear();
  });

  it('plays no tap while the balance and theme rows load', async () => {
    const rendered = renderThemes();
    await rendered.findByText('600');
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap to purchase and apply an unowned, affordable theme', async () => {
    const rendered = renderThemes();
    await rendered.findByText('600');
    fireEvent.press(rendered.getByLabelText('Unlock the Wood theme for 500 coins'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(recordOnce).toHaveBeenCalledTimes(1));
    expect(recordOnce).toHaveBeenCalledWith({
      deltaCoins: -500,
      deltaHints: 0,
      reason: 'theme-unlock',
      ref: 'wood',
    });
    expect(mockSetThemeId).toHaveBeenCalledWith('wood');
  });

  it('plays one tap on the header back button', async () => {
    const rendered = renderThemes();
    await rendered.findByText('600');
    fireEvent.press(rendered.getByLabelText('Go back'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
