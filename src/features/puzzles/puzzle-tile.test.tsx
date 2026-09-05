import { fireEvent, render } from '@testing-library/react-native';

import { PuzzleTile } from './puzzle-tile';

/**
 * The tile is the whole Puzzles screen now, so its contract is the screen's:
 * one tap target per image, the artwork carried through, and progress announced
 * without a control sitting on top of the picture.
 *
 * The tile is a *visual gallery*: it shows the image and nothing else. Puzzle
 * titles stay in the data (navigation and the game need them) but are never
 * presented here — not as text and not in the screen-reader label.
 *
 * It takes props only — no repository, no router — which is what lets it be
 * rendered here. `ThemeContext` defaults to MEADOW (`theme-context.tsx:27`), so
 * no provider is needed, the same way `piece-picker.test.tsx` renders bare.
 */

function renderTile({
  source = 1 as number | string | null,
  badge = null,
  index = 0,
  onPress = jest.fn(),
}: Partial<Parameters<typeof PuzzleTile>[0]> = {}) {
  return { ...render(<PuzzleTile {...{ source, badge, index, onPress }} />), onPress };
}

describe('PuzzleTile', () => {
  it('is announced as an image, title-free', () => {
    const { getByLabelText } = renderTile();
    expect(getByLabelText('Puzzle image. Double tap to select.')).toBeTruthy();
    expect(() => getByLabelText(/First Light/)).toThrow();
  });

  it('shows no puzzle name as visible text', () => {
    const { queryByText } = renderTile();
    expect(queryByText(/First Light/)).toBeNull();
  });

  it('does not expose a puzzle name through the screen-reader label', () => {
    const { queryByLabelText } = renderTile();
    expect(
      queryByLabelText(/First Light|Playful Monkey|Pond Friends|Frog Mugshot|Lazy Afternoon/),
    ).toBeNull();
  });

  it('is one tap target, not an image plus a button', () => {
    // The brief is explicit: no Start button per tile, the picture is the
    // control. One pressable is the whole point — two would reintroduce the
    // "which half did I hit" problem the old StarterRow had, where only the
    // button worked and tapping the thumbnail did nothing.
    const { getByLabelText, onPress } = renderTile();
    fireEvent.press(getByLabelText('Puzzle image. Double tap to select.'));
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
    const { getByLabelText } = renderTile({ badge: { kind: 'progress', percent: 40 } });
    expect(getByLabelText('Puzzle image, 40% complete. Double tap to select.')).toBeTruthy();
  });

  it('marks a finished puzzle for sighted and assistive readers alike', () => {
    const { getByLabelText, getByTestId } = renderTile({ badge: { kind: 'completed' } });
    expect(getByLabelText('Puzzle image, completed. Double tap to select.')).toBeTruthy();
    expect(getByTestId('puzzle-tile-badge')).toBeTruthy();
  });

  it('is announced as a button', () => {
    const { getByLabelText } = renderTile();
    expect(getByLabelText('Puzzle image. Double tap to select.').props.accessibilityRole).toBe(
      'button',
    );
  });
});
