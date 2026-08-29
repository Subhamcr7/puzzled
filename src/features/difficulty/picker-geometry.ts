import { spacing } from '@/shared/theme';
import { MAX_FONT_SCALE } from '@/shared/ui/Text';

/**
 * Piece-count picker geometry, kept free of React Native so it can be tested
 * directly, like `tray-geometry` does for the tray.
 *
 * The picker is a horizontal carousel: the strip carries its items with `gap`
 * between them, the content is padded so the first and last items can reach the
 * viewport centre, and the scroll snaps to each item's offset. That only works
 * if an item's snap offset equals its left edge — with padding `(containerWidth −
 * itemWidth) / 2` on both sides, offset `x` puts content point `x` at the left
 * edge, and the item whose left edge is at `x` lands dead centre. Hence every
 * function here resolves around `pitch`.
 */

/** Largest count label an item shows, in digits. */
export const PICKER_MAX_DIGITS = 3;

/** The count's designed size, matching the picker's title face. */
export const PICKER_COUNT_FONT = 30;

/**
 * An item's width, so the largest count (three digits at the title size, scaled
 * to the app's font ceiling) still fits with its padding.
 *
 * Derived from `MAX_FONT_SCALE` rather than a fixed number for the same reason
 * `src/shared/ui/Text.tsx` exists: Android scales every label, and a fixed item
 * width that fits at scale 1.0 clips at 1.25 once the count fills it.
 */
export function pickerItemWidth(fontScale = MAX_FONT_SCALE): number {
  // A digit in the display face measures roughly 0.66em at its designed weight.
  return Math.ceil(PICKER_COUNT_FONT * fontScale * 0.66 * PICKER_MAX_DIGITS + spacing.md * 2);
}

export interface PickerGeometry {
  itemWidth: number;
  itemGap: number;
  /** Content padding on each side, centring the first and last items. */
  sidePadding: number;
  /** One item's snap distance: its width plus the inter-item gap. */
  pitch: number;
}

export function pickerGeometry(containerWidth: number): PickerGeometry {
  const itemWidth = pickerItemWidth();
  const itemGap = spacing.lg;
  const sidePadding = Math.max(0, (containerWidth - itemWidth) / 2);
  return { itemWidth, itemGap, sidePadding, pitch: itemWidth + itemGap };
}

/** The scroll offset that centres the item at `index`. */
export function offsetForIndex(index: number, geometry: PickerGeometry): number {
  return index * geometry.pitch;
}

/** The item nearest a scroll offset, clamped to the list. */
export function indexForOffset(
  offset: number,
  geometry: PickerGeometry,
  itemCount: number,
): number {
  const index = Math.round(offset / geometry.pitch);
  return Math.max(0, Math.min(itemCount - 1, index));
}

/** Scroll offset for every item, in order — the carousel's snap points. */
export function snapOffsets(itemCount: number, geometry: PickerGeometry): number[] {
  return Array.from({ length: itemCount }, (_, index) => offsetForIndex(index, geometry));
}
