import { fireEvent, render } from '@testing-library/react-native';

import { getCompletionsRepository, getProgressRepository } from '@/data';

import { StatisticsScreen } from './statistics-screen';

jest.mock('react-native-svg', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    Svg: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    Circle: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
}));

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  getProgressRepository: jest.fn(),
  getCompletionsRepository: jest.fn(),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const React = jest.requireActual('react');
  return {
    useRouter: () => ({ back: mockBack }),
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

const streamRows = [
  { puzzleId: 'a', gridSize: 6, lockedPieces: 20, totalPieces: 40, elapsedMs: 9_000 },
];
const completions = [
  { puzzleId: 'a', gridSize: 6, elapsedMs: 100_000, completedAt: '2026-09-01T12:00:00.000Z' },
];

function renderStatistics(rows: unknown[] = streamRows, log: unknown[] = completions) {
  (getProgressRepository as jest.Mock).mockResolvedValue({ listSummaries: async () => rows });
  (getCompletionsRepository as jest.Mock).mockResolvedValue({
    list: async () => log,
  });
  return render(<StatisticsScreen />);
}

describe('StatisticsScreen', () => {
  beforeEach(() => {
    mockPlayUiTap.mockClear();
  });

  it('renders every stat tile from the log with no tap sound', async () => {
    const rendered = renderStatistics();
    await rendered.findByText('PUZZLES COMPLETED');
    expect(mockPlayUiTap).not.toHaveBeenCalled();
    expect(rendered.getAllByText(/^1$/).length).toBeGreaterThan(0);
  });

  it('shows the empty readout when there is no play history', async () => {
    const rendered = renderStatistics([], []);
    await rendered.findByText('PUZZLES COMPLETED');
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap on the header back button', async () => {
    const rendered = renderStatistics();
    await rendered.findByText('PUZZLES COMPLETED');
    fireEvent.press(rendered.getByLabelText('Go back'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
