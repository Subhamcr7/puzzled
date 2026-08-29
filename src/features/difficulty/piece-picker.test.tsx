import { fireEvent, render } from '@testing-library/react-native';

import { SUPPORTED_GRID_SIZES, type GridSize } from '@/game-engine';
import { type PuzzleProgressSummary } from '@/data';

import { pickerGeometry, offsetForIndex } from './picker-geometry';
import { PiecePicker } from './piece-picker';

function summary(overrides: Partial<PuzzleProgressSummary> = {}): PuzzleProgressSummary {
  return {
    puzzleId: 'first-light',
    gridSize: 4,
    status: 'in-progress',
    lockedPieces: 12,
    totalPieces: 16,
    elapsedMs: 0,
    updatedAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  };
}

function renderPicker({
  selected = 4 as GridSize,
  saved = new Map<GridSize, PuzzleProgressSummary>(),
  onSelect = jest.fn(),
} = {}) {
  return render(
    <PiecePicker
      sizes={SUPPORTED_GRID_SIZES}
      selected={selected}
      saved={saved}
      onSelect={onSelect}
    />,
  );
}

/**
 * The picker replaces the difficulty screen's two-column tile grid. These tests
 * pin the behaviour the grid had — one labelled target per size, the selected
 * size marked, saved progress announced — plus the pieces a carousel adds: a
 * tamper target for every item and live selection while the strip moves.
 */

describe('PiecePicker', () => {
  it('labels every supported size with its count and tier', () => {
    const { getByLabelText } = renderPicker();
    expect(getByLabelText('9 pieces, Easy')).toBeTruthy();
    expect(getByLabelText('25 pieces, Medium')).toBeTruthy();
    expect(getByLabelText('100 pieces, Hard')).toBeTruthy();
  });

  it('marks the selected size for assistive technology', () => {
    const { getByLabelText } = renderPicker({ selected: 8 });
    expect(getByLabelText('64 pieces, Hard')).toBeEnabled();
    expect(getByLabelText('64 pieces, Hard').props.accessibilityState?.selected).toBe(true);
    expect(getByLabelText('9 pieces, Easy').props.accessibilityState?.selected).toBe(false);
  });

  it('selects a size on tap', () => {
    const onSelect = jest.fn();
    const { getByLabelText } = renderPicker({ onSelect });
    fireEvent.press(getByLabelText('25 pieces, Medium'));
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it('selects a size live while the strip scrolls', async () => {
    fireEvent(renderPicker({}).getByTestId('piece-picker'), 'layout', {
      nativeEvent: { layout: { width: 393, height: 140 } },
    });
    const onSelect = jest.fn();
    const rendered = renderPicker({ onSelect });
    const geometry = pickerGeometry(393);
    const strip = rendered.getByTestId('piece-picker');
    fireEvent(strip, 'scroll', {
      nativeEvent: { contentOffset: { x: offsetForIndex(2, geometry) } },
    });
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it('is a drop-in for the tile grid: a saved board shows its pill and label', () => {
    const saved = new Map<GridSize, PuzzleProgressSummary>([[4, summary()]]);
    const { getByLabelText, getByText } = renderPicker({ selected: 4, saved });
    // The a11y label carries the progress for every size...
    expect(getByLabelText('16 pieces, Easy, 12 of 16 already placed')).toBeTruthy();
    // ...and the visible pill sits under the centred size.
    expect(getByText('12/16')).toBeTruthy();
  });
});
