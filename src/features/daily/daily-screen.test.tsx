import { fireEvent, render } from '@testing-library/react-native';

import { getCompletionsRepository, listCatalog } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';

import { MONTHS } from './calendar';
import { DailyScreen } from './daily-screen';

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  listCatalog: jest.fn(),
  getCompletionsRepository: jest.fn(),
  resolvePuzzleImageSource: jest.fn(() => 1),
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
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

const puzzle: PuzzleDefinition[] = [
  {
    id: 'first-light',
    title: 'First Light',
    image: { uri: '', pixelSize: { width: 1, height: 1 } },
    gridSize: 4,
    seed: 'a',
    revision: 1,
  },
];

async function renderDaily() {
  (listCatalog as jest.Mock).mockResolvedValue({ bundled: puzzle, user: [] });
  (getCompletionsRepository as jest.Mock).mockResolvedValue({ list: async () => [] });
  const rendered = render(<DailyScreen />);
  const month = MONTHS[new Date().getMonth()];
  const day = new Date().getDate();
  await rendered.findByLabelText(`${month} ${day}`);
  return { rendered, month, day };
}

describe('DailyScreen tap sounds', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
  });

  it('renders no sound while the calendar and today’s pick load', async () => {
    await renderDaily();
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap when a day cell is pressed', async () => {
    const { rendered, month, day } = await renderDaily();
    fireEvent.press(rendered.getByLabelText(`${month} ${day}`));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
  });

  it('keeps future days inactive for assistive technology', async () => {
    const { rendered, month, day } = await renderDaily();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    if (day < daysInMonth) {
      const future = rendered.getByLabelText(`${month} ${day + 1}, not yet unlocked`);
      expect(future.props.accessibilityState?.disabled).toBe(true);
      expect(future.props.accessibilityState?.selected).toBe(false);
      expect(future.props.accessibilityRole).toBe('button');
    }
  });

  it('plays one tap on the header back button', async () => {
    const { rendered } = await renderDaily();
    fireEvent.press(rendered.getByLabelText('Go back'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
