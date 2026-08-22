import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadow } from '@/shared/theme';

export type SurfaceElevation = 'card' | 'raised' | 'pressed' | 'none';

interface PopSurfaceProps {
  children?: ReactNode;
  /** Face colour. */
  fill?: string;
  radius?: number;
  /** Which shadow token to wear. `none` is for surfaces nested inside another. */
  elevation?: SurfaceElevation;
  /** Style for the outer wrapper — use for margins, width, flex. */
  style?: StyleProp<ViewStyle>;
  /** Style for the face — use for padding, alignment. */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Whether the face clips its children to the radius. On by default, because
   * nested photos have to follow the corner.
   *
   * Turn it **off** on a surface whose children are text. The clip cuts a glyph's
   * descender as readily as a photo's corner, and a `y` without its tail reads as
   * a missing letter — which is what put "Librar" in the tab bar.
   */
  clip?: boolean;
  testID?: string;
}

/**
 * The Puzzle Journey card primitive: a soft-shadowed, un-outlined rounded face.
 *
 * Unlike the Chunky Pop version this replaces, there is no sibling shadow view
 * and no border. `boxShadow` (RN 0.86) draws a real blurred shadow on both
 * platforms, so the shadow no longer occupies layout space — which is why this
 * component no longer pads its wrapper.
 *
 * The shadow and the fill live on the wrapper while the clip lives on the inner
 * face. Putting both on one node risks the clip eating the shadow, and costs
 * nothing to separate. The clip itself is opt-out — see `clip`.
 */
export function PopSurface({
  children,
  fill = colors.surface,
  radius = radii.md,
  elevation = 'card',
  style,
  contentStyle,
  clip = true,
  testID,
}: PopSurfaceProps) {
  return (
    <View
      testID={testID}
      style={[
        { backgroundColor: fill, borderRadius: radius },
        elevation !== 'none' && { boxShadow: shadow[elevation] },
        style,
      ]}
    >
      <View
        testID={testID ? `${testID}-face` : undefined}
        style={[clip && styles.clipped, { borderRadius: radius }, contentStyle]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clipped: { overflow: 'hidden' },
});
