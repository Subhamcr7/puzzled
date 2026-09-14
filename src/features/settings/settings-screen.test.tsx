import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { DEFAULT_SETTINGS, getSettingsRepository } from '@/data';
import { configureAudioSettings } from '@/features/game/board-audio';

import { SettingsScreen } from './settings-screen';

jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

jest.mock('@/features/game/board-audio', () => ({
  configureAudioSettings: jest.fn(),
}));

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  getSettingsRepository: jest.fn(),
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const repoSet = jest.fn(async () => DEFAULT_SETTINGS);

function renderSettings(get: () => Promise<unknown> = async () => DEFAULT_SETTINGS) {
  (getSettingsRepository as jest.Mock).mockResolvedValue({ get, set: repoSet });
  return render(<SettingsScreen />);
}

describe('SettingsScreen tap sounds', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
    repoSet.mockClear();
    (configureAudioSettings as jest.Mock).mockClear();
  });

  it('plays no tap while the persisted settings hydrate the switches', async () => {
    const rendered = renderSettings();
    await rendered.findByLabelText('Sound');
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap and reconfigures the live audio when Sound is toggled', async () => {
    const rendered = renderSettings();
    await rendered.findByLabelText('Sound');
    fireEvent.press(rendered.getByLabelText('Sound'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(configureAudioSettings).toHaveBeenCalledTimes(1);
    const merged = (configureAudioSettings as jest.Mock).mock.calls[0][0];
    expect(merged.sound).toBe(false);
    expect(merged.themeId).toBe('meadow');
    await waitFor(() => expect(repoSet).toHaveBeenCalledWith({ sound: false }));
  });

  it('plays one tap per toggle across the two groups', async () => {
    const rendered = renderSettings();
    await rendered.findByLabelText('Sound');
    fireEvent.press(rendered.getByLabelText('Haptics'));
    fireEvent.press(rendered.getByLabelText('Snap assist'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(repoSet).toHaveBeenCalledWith({ haptics: false }));
    expect(repoSet).toHaveBeenCalledWith({ snapAssist: false });
  });

  it('plays one tap on the Themes link and routes', async () => {
    const rendered = renderSettings();
    await rendered.findByLabelText('Sound');
    fireEvent.press(rendered.getByLabelText('Themes'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/themes');
  });

  it('plays one tap on the header back button', async () => {
    const rendered = renderSettings();
    await rendered.findByLabelText('Sound');
    fireEvent.press(rendered.getByLabelText('Go back'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
