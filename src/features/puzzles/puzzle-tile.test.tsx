import { fireEvent, render } from '@testing-library/react-native';

import { PuzzleTile } from './puzzle-tile';

/**
 * The tile is the whole Puzzles screen now, so its contract is the screen's:
 * one tap target per image, the artwork carried through, and progress announced
 * without a control sitting on top of the picture.
 *
 * It takes props only — no repository, no router — which is what lets it be
 * rendered here. `ThemeContext` defaults to MEADOW (`theme-context.tsx:27`), so
 * no provider is needed, the same way `piece-picker.test.tsx` renders bare.
 */

function renderTile({
  title = 'First Light',
  source = 1 as number | string | null,
  badge = null,
  index = 0,
  onPress = jest.fn(),
}: Partial<Parameters<typeof PuzzleTile>[0]> = {}) {
  return { ...render(<PuzzleTile {...{ title, source, badge, index, onPress }} />), onPress };
}

describe('PuzzleTile', () => {
  it('names the puzzle so the image is reachable by title', () => {
    const { getByLabelText } = renderTile({ title: 'Pond Friends' });
    expect(getByLabelText('Pond Friends')).toBeTruthy();
  });

  it('shows the title as visible text too', () => {
    const { getByText } = renderTile({ title: 'Frog Mugshot' });
    expect(getByText('Frog Mugshot')).toBeTruthy();
  });

  it('is one tap target, not an image plus a button', () => {
    // The brief is explicit: no Start button per tile, the picture is the
    // control. One pressable is the whole point — two would reintroduce the
    // "which half did I hit" problem the old StarterRow had, where only the
    // button worked and tapping the thumbnail did nothing.
    const { getByLabelText, onPress } = renderTile({ title: 'Lazy Afternoon' });
    fireEvent.press(getByLabelText('Lazy Afternoon'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('carries the puzzle image through as-is', () => {
    const { getByTestId } = renderTile({ source: 42 });
    expect(getByTestId('puzzle-tile-image').props.source).toBe(42);
  });

  it('treats a string source as a uri', () => {
    // Imported photos arrive as `file://` strings from
    // `resolvePuzzleImageSource`, bundled art as a require() module id.
    const { getByTestId } = renderTile({ source: 'file:///photo.jpg' });
    expect(getByTestId('puzzle-tile-image').props.source).toEqual({ uri: 'file:///photo.jpg' });
  });

  it('falls back to art when a puzzle has no resolvable image', () => {
    const { queryByTestId, getByTestId } = renderTile({ source: null });
    expect(queryByTestId('puzzle-tile-image')).toBeNull();
    expect(getByTestId('puzzle-tile-fallback')).toBeTruthy();
  });

  it('wears no badge when there is no progress', () => {
    const { queryByTestId } = renderTile({ badge: null });
    expect(queryByTestId('puzzle-tile-badge')).toBeNull();
  });

  it('overlays the percentage when a board is part-built', () => {
    const { getByText } = renderTile({ badge: { kind: 'progress', percent: 40 } });
    expect(getByText('40%')).toBeTruthy();
  });

  it('announces progress in the label, not just as a visual', () => {
    const { getByLabelText } = renderTile({
      title: 'First Light',
      badge: { kind: 'progress', percent: 40 },
    });
    expect(getByLabelText('First Light, 40% complete')).toBeTruthy();
  });

  it('marks a finished puzzle for sighted and assistive readers alike', () => {
    const { getByLabelText, getByTestId } = renderTile({
      title: 'First Light',
      badge: { kind: 'completed' },
    });
    expect(getByLabelText('First Light, completed')).toBeTruthy();
    expect(getByTestId('puzzle-tile-badge')).toBeTruthy();
  });

  it('is announced as a button', () => {
    const { getByLabelText } = renderTile({ title: 'First Light' });
    expect(getByLabelText('First Light').props.accessibilityRole).toBe('button');
  });
});
