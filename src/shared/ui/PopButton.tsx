import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { FONT_SCALE } from '@/shared/font-scale';
import { colors, radii, shadow, spacing, typography } from '@/shared/theme';

import { PressDarken, usePressProgress } from './PressDarken';

export type PopTone =
  | 'grass'
  | 'lime'
  | 'leaf'
  | 'sky'
  | 'berry'
  | 'blossom'
  | 'honey'
  | 'apricot'
  | 'cherry'
  | 'surface';

/**
 * Button faces, paired with the label colour that clears WCAG AA large-text
 * (3.0:1) on them. Exported so the contrast test checks the real table rather
 * than a copy of it.
 *
 * This palette is bright enough that white text fails on almost all of it — the
 * mockup's own white-on-green measures 2.21:1. Tones that want white therefore
 * use their `*Deep` variant; everything else takes ink on the bright value.
 * Verified ratios are in the trailing comments.
 *
 * For a gradient tone this is the mid stop, which is also what the face falls back
 * to if the gradient does not apply. `TONE_GRADIENT` carries the rest, and the
 * contrast test walks every stop rather than trusting this one value.
 */
export const TONE_FILL: Record<PopTone, string> = {
  grass: colors.grassDeep,
  lime: colors.lime,
  leaf: colors.leaf,
  sky: colors.skyDeep,
  berry: colors.berry,
  blossom: colors.blossom,
  honey: colors.honey,
  apricot: colors.apricot,
  cherry: colors.cherry,
  surface: colors.surface,
};

export const TONE_LABEL: Record<PopTone, string> = {
  grass: colors.onFill, // 3.25
  lime: colors.ink, // 8.79 / 7.18 / 3.67 across the gradient stops
  leaf: colors.ink, // 6.63
  sky: colors.onFill, // 3.21
  berry: colors.onFill, // 3.60
  blossom: colors.ink, // 6.11
  honey: colors.ink, // 10.08
  apricot: colors.ink, // 6.45
  cherry: colors.onFill, // 3.64
  surface: colors.ink, // 12.47
};

/**
 * Tones whose face is a radial gradient rather than one flat colour, ordered from
 * the highlight outward.
 *
 * Exported as data, not as a finished CSS string, so the contrast test can measure
 * each stop against the label. A hand-written string would let the drawn gradient
 * and the tested one drift apart silently.
 */
export const TONE_GRADIENT: Partial<Record<PopTone, readonly [string, string, string]>> = {
  lime: [colors.limeLight, colors.lime, colors.limeDeep],
};

/**
 * The highlight sits above centre rather than dead centre: a centred highlight on a
 * wide pill reads as a flat lighter band, while an offset one reads as light falling
 * on a domed surface. An ellipse rather than a circle for the same reason — a circle
 * sized to the farthest corner of a wide button pushes its stops off the ends.
 */
function radialFace([highlight, mid, rim]: readonly [string, string, string]): string {
  return `radial-gradient(ellipse at 50% 20%, ${highlight} 0%, ${mid} 50%, ${rim} 100%)`;
}

/**
 * `lineHeight` is set generously against each `fontSize` — about 1.4x — rather than
 * left to the font's own metrics, so a `y` has room below the baseline.
 *
 * These are **base** values. The component applies them multiplied by the startup
 * font scale (see `@/shared/font-scale`) through module-level styles.
 */
const SIZE = {
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    lineHeight: 21,
    radius: radii.sm,
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    lineHeight: 25,
    radius: radii.md,
  },
  lg: {
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.xl,
    fontSize: 22,
    lineHeight: 30,
    radius: radii.lg,
  },
} as const;

/**
 * Label text styles per size, with the startup font scale baked in. Module level
 * so the objects are shared rather than rebuilt per render.
 */
const SCALED_LABEL = Object.fromEntries(
  (Object.keys(SIZE) as (keyof typeof SIZE)[]).map((size) => [
    size,
    {
      fontSize: SIZE[size].fontSize * FONT_SCALE,
      lineHeight: Math.round(SIZE[size].lineHeight * FONT_SCALE),
    },
  ]),
) as Record<keyof typeof SIZE, { fontSize: number; lineHeight: number }>;

interface PopButtonProps {
  label: string;
  onPress?: () => void;
  tone?: PopTone;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  /** Rendered before the label — pass an `Art` or a `PopIcon`. */
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function PopButton({
  label,
  onPress,
  tone = 'grass',
  size = 'md',
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: PopButtonProps) {
  const { progress, pressHandlers } = usePressProgress();
  const metrics = SIZE[size];
  const gradient = TONE_GRADIENT[tone];

  // Chunky Pop translated the face into a hard sibling shadow. With a blurred
  // shadow there is nothing to translate into, so the press reads as the button
  // squashing down into the page. `PressDarken` carries the colour half of the
  // press; on a saturated fill the squash alone is too quiet to register.
  //
  // Only the transform is animated. `boxShadow` is not a Reanimated-animatable
  // prop, so it stays a static style rather than being driven off `progress`.
  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * 0.04 }, { translateY: progress.value * 2 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...pressHandlers}
      style={[disabled && styles.disabled, style]}
    >
      <Animated.View
        style={[
          styles.face,
          {
            backgroundColor: TONE_FILL[tone],
            borderRadius: metrics.radius,
            paddingVertical: metrics.paddingVertical,
            paddingHorizontal: metrics.paddingHorizontal,
          },
          faceStyle,
        ]}
      >
        {/* The gradient is its own layer rather than the face's own background.
            `experimental_backgroundImage` is as experimental as its name says, and on
            the face it parents the label — which makes it a suspect for clipping its
            own children, and it is the only thing separating Play from every other
            button in the app whose label renders fine. Drawn as an overlay it looks
            identical and parents nothing. Same reasoning as `PressDarken` below. */}
        {gradient ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: metrics.radius,
                experimental_backgroundImage: radialFace(gradient),
              },
            ]}
          />
        ) : null}
        <PressDarken progress={progress} radius={metrics.radius} />
        {icon}
        <Text
          allowFontScaling={false}
          style={[styles.label, SCALED_LABEL[size], { color: TONE_LABEL[tone] }]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    boxShadow: shadow.button,
  },
  // "Play" rendered as "Pla" because Fredoka had not been registered yet when
  // Fabric measured this label: the box was sized for the fallback face and then
  // painted with the wider Fredoka. The families are embedded at build time now
  // (`src/shared/fonts.test.ts`), so measure and paint use the same typeface.
  //
  // The room below is kept regardless, since none of it costs anything:
  //
  //   - `lineHeight` (in `SIZE`) well above the font size, for the `y` tail.
  //   - `paddingHorizontal` as ink room for a glyph overhanging its advance width.
  //   - `flexShrink: 0`, because the face is a flex row: with an icon beside it the
  //     label is otherwise a candidate for shrinking, and a shrunk text node clips
  //     rather than scrolls.
  //
  // Symmetric padding so the label stays optically centred.
  label: {
    fontFamily: typography.heading.fontFamily,
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  disabled: { opacity: 0.45 },
});
