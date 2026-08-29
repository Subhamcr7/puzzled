import { spacing } from '@/shared/theme';
import { MAX_FONT_SCALE } from '@/shared/ui/Text';

import {
  indexForOffset,
  offsetForIndex,
  PICKER_COUNT_FONT,
  PICKER_MAX_DIGITS,
  pickerGeometry,
  pickerItemWidth,
  snapOffsets,
} from './picker-geometry';

/**
 * The piece-count picker is a horizontal carousel: tapping or flicking settles on
 * one item, centred, and the item under the centre is the selected size. All the
 * arithmetic that makes that true — item widths, snap offsets and the mapping
 * between a scroll offset and an index — lives here, free of React Native, so it
 * is testable exactly like `tray-geometry`.
 */

describe('picker geometry', () => {
  it('centres an item at the ends of the strip', () => {
    const geometry = pickerGeometry(360);
    // The strip's side padding leaves the first and last items able to reach the
    // viewport centre. If this ever goes negative, a snap target sits off-screen.
    expect(geometry.sidePadding + geometry.itemWidth / 2).toBeCloseTo(360 / 2, 5);
    expect(geometry.sidePadding).toBeGreaterThan(0);
  });

  it('spaces items by one width plus the inter-item gap', () => {
    const geometry = pickerGeometry(360);
    expect(geometry.pitch).toBe(geometry.itemWidth + geometry.itemGap);
  });

  it('keeps the largest count readable at the font-scale ceiling', () => {
    // The count text is the widest thing inside an item: three digits at the 30pt
    // title face, scaled to the app's font ceiling. The item must absorb that plus
    // breathing room — and grow if the ceiling ever does.
    const digitsWidth = PICKER_COUNT_FONT * MAX_FONT_SCALE * 0.66 * PICKER_MAX_DIGITS;
    expect(pickerItemWidth()).toBeGreaterThanOrEqual(digitsWidth + spacing.md * 2);
    expect(pickerItemWidth(1.0)).toBeLessThan(pickerItemWidth(1.25));
  });

  it('maps an index to its offset and back', () => {
    const geometry = pickerGeometry(360);
    for (const index of [0, 1, 3, 7]) {
      expect(indexForOffset(offsetForIndex(index, geometry), geometry, 8)).toBe(index);
    }
  });

  it('rounds a half-finished gesture to the nearest item', () => {
    const geometry = pickerGeometry(360);
    expect(indexForOffset(geometry.pitch * 1.4, geometry, 8)).toBe(1);
    expect(indexForOffset(geometry.pitch * 1.6, geometry, 8)).toBe(2);
  });

  it('clamps the index at either end of the list', () => {
    const geometry = pickerGeometry(360);
    expect(indexForOffset(-120, geometry, 8)).toBe(0);
    expect(indexForOffset(geometry.pitch * 10, geometry, 8)).toBe(7);
  });

  it('snaps every item to an offset that is reachable', () => {
    const geometry = pickerGeometry(360);
    const offsets = snapOffsets(8, geometry);
    expect(offsets).toHaveLength(8);
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    }
    const contentWidth = geometry.sidePadding * 2 + 8 * geometry.itemWidth + 7 * geometry.itemGap;
    // The last snap must not sit past the strip's right edge.
    expect(offsets[7]).toBeCloseTo(contentWidth - 360, 5);
  });
});
