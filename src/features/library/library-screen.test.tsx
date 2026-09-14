import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  getCompletionsRepository,
  getFavouritesRepository,
  getProgressRepository,
  getUserPuzzleRepository,
  listCatalog,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';

import { LibraryScreen } from './library-screen';

jest.mock('@/data', () => ({
  ...jest.requireActual('@/data'),
  listCatalog: jest.fn(),
  getProgressRepository: jest.fn(),
  getFavouritesRepository: jest.fn(),
  getCompletionsRepository: jest.fn(),
  getUserPuzzleRepository: jest.fn(),
  resolvePuzzleImageSource: jest.fn(() => 1),
}));

const mockPlayUiTap = jest.fn();
jest.mock('@/shared/ui/ui-sound', () => ({
  playUiTap: (...args: unknown[]) => mockPlayUiTap(...args),
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

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: false })),
  launchImageLibraryAsync: jest.fn(),
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

const bundle: PuzzleDefinition[] = [
  {
    id: 'first-light',
    title: 'First Light',
    image: { uri: '', pixelSize: { width: 1, height: 1 } },
    gridSize: 4,
    seed: 'a',
    revision: 1,
  },
];

const photo: PuzzleDefinition = {
  id: 'user-pic',
  title: 'Photo Pic',
  image: { uri: 'file:///photo.jpg', pixelSize: { width: 1, height: 1 } },
  gridSize: 4,
  seed: 'u',
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

const toggleMock = { toggle: jest.fn(async () => true) };

function renderLibrary({
  favourites = [] as string[],
  summaries = [summary],
}: {
  favourites?: string[];
  summaries?: (typeof summary)[];
} = {}) {
  (listCatalog as jest.Mock).mockResolvedValue({ bundled: bundle, user: [photo] });
  (getProgressRepository as jest.Mock).mockResolvedValue({
    listSummaries: async () => summaries,
    deleteSessionsForPuzzle: jest.fn(async () => {}),
  });
  (getFavouritesRepository as jest.Mock).mockResolvedValue({
    ...toggleMock,
    list: async () => favourites,
  });
  (getCompletionsRepository as jest.Mock).mockResolvedValue({
    list: async () => [],
    deleteForPuzzle: jest.fn(async () => {}),
  });
  (getUserPuzzleRepository as jest.Mock).mockResolvedValue({
    add: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  });
  return render(<LibraryScreen />);
}

describe('LibraryScreen tap sounds', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockPlayUiTap.mockClear();
    mockPush.mockClear();
    toggleMock.toggle.mockClear();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('renders no sound from loading, tabs drawing or progress data arriving', async () => {
    const rendered = renderLibrary();
    await rendered.findByLabelText('First Light');
    expect(mockPlayUiTap).not.toHaveBeenCalled();
  });

  it('plays one tap when a row is pressed, and resumes the saved board', async () => {
    const rendered = renderLibrary();
    await rendered.findByLabelText('First Light');
    fireEvent.press(rendered.getByLabelText('First Light'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/game/[puzzleId]',
      params: { puzzleId: 'first-light', size: '4' },
    });
  });

  it('plays one tap to favourite a puzzle that is not yet starred', async () => {
    const rendered = renderLibrary();
    await rendered.findByLabelText('First Light');
    fireEvent.press(rendered.getByLabelText('Add First Light to favourites'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggleMock.toggle).toHaveBeenCalledWith('first-light'));
  });

  it('plays one tap to un-favourite a puzzle that is already starred', async () => {
    const rendered = renderLibrary({ favourites: ['first-light'] });
    await rendered.findByLabelText('First Light');
    fireEvent.press(rendered.getByLabelText('Remove First Light from favourites'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
  });

  it('plays one tap on Add photo, even when the permission prompt follows', async () => {
    const rendered = renderLibrary();
    await rendered.findByLabelText('First Light');
    fireEvent.press(rendered.getByLabelText('Add a puzzle from your gallery'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Photos permission needed',
        'Allow photo access to turn an image into a puzzle.',
      ),
    );
  });

  it('plays one tap when a tab chip is pressed', async () => {
    const rendered = renderLibrary();
    await rendered.findByLabelText('First Light');
    fireEvent.press(rendered.getByLabelText('Completed'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(1);
  });

  it('plays one tap to delete an imported photo', async () => {
    const rendered = renderLibrary();
    await rendered.findByLabelText('First Light');
    fireEvent.press(rendered.getByLabelText('My Photos'));
    await rendered.findByLabelText('Photo Pic');
    fireEvent.press(rendered.getByLabelText('Delete Photo Pic'));
    expect(mockPlayUiTap).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete “Photo Pic”?',
      'This also deletes any progress on it. It cannot be undone.',
      expect.any(Array),
    );
  });
});
