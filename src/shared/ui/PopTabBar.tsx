import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ArtName } from '@/shared/art';
import { colors, radii, spacing, typography } from '@/shared/theme';

import { Art } from './Art';
import { PopSurface } from './PopSurface';

// `Tabs.tabBar` receives BottomTabBarProps; derive it without a subpath import
// (expo-router does not re-export the type from its top-level entry point).
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Tab identity, art, and the tint its label takes when focused.
 *
 * The route names are unchanged from Chunky Pop — this is a re-skin, so
 * Puzzles/Library keep their names rather than becoming the mockup's
 * Collection/Rewards, which would have meant new screens.
 *
 * `change-avatar` (the bear head) rather than `profile` (a generic orange
 * silhouette) for the Profile tab, matching the mockup and the rest of the set.
 */
const TABS: Record<string, { art: ArtName; label: string; tint: string }> = {
  index: { art: 'home', label: 'Home', tint: colors.headingGreen },
  puzzles: { art: 'category', label: 'Puzzles', tint: colors.sky },
  library: { art: 'album', label: 'Library', tint: colors.apricot },
  profile: { art: 'change-avatar', label: 'Profile', tint: colors.berry },
};

/**
 * Bar metrics, named so the styles below and `useTabBarSpace` read from the same
 * numbers. Previously each screen guessed, and every screen guessed zero — so
 * content scrolled underneath and the last row was unreadable.
 */
const ICON_SIZE = 26;
/**
 * Vertical room for the label line.
 *
 * 18, not the 14 this used to be. An 11pt Nunito Bold line box is taller than 11pt
 * once Android's `includeFontPadding` is counted, so 14 left the descender hanging
 * outside the budget — and `PopSurface` used to enforce that budget with
 * `overflow: hidden`, which is the likeliest reason "Library" rendered as "Librar".
 * The clip is now off (see the `clip` prop below); this gives the line room even so.
 */
const LABEL_LINE = 18;
const ITEM_GAP = 2;
const BAR_HEIGHT = spacing.sm + ICON_SIZE + ITEM_GAP + LABEL_LINE + spacing.xs;

/**
 * Vertical space a screen under `(tabs)/` must reserve at the bottom of its
 * scroll content, because the bar floats over the scene rather than sitting
 * below it.
 *
 * The bar floats for a reason: in normal flow it rendered on the *navigator's*
 * background, so beneath it sat a strip of `paper` that did not match whichever
 * background the screen itself used — three stacked colours on Home, which read
 * as the bar being cut off. Floating lets each screen's own background run to
 * the bottom edge.
 *
 * Lives here because this component owns the metrics: change its padding and
 * every screen's reservation follows, instead of silently starting to clip.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, spacing.md) + spacing.md;
}

/** Puzzle Journey bottom navigation, used as the custom `tabBar` for Tabs. */
export function PopTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  // Font scaling is done BY HAND (see `PopButton`): Android's `allowFontScaling`
  // path paints only the first few glyphs of an auto-scaled label on
  // RN 0.86/Fabric — "Library" rendered as "Librar" above 1.0x font scale.
  const { fontScale } = useWindowDimensions();

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
      pointerEvents="box-none"
    >
      {/* `clip={false}`: the face's clip cuts a descender as readily as a photo
          corner, and every child here is an icon or a label — nothing needs
          clipping to the radius. */}
      <PopSurface radius={radii.xl} elevation="raised" clip={false} contentStyle={styles.bar}>
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) {
            return null;
          }
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={meta.label}
              onPress={onPress}
              style={styles.item}
            >
              {/* The art is full-colour, so focus cannot be shown by tinting
                  it. A soft pill behind the icon carries the state instead, and
                  unfocused tabs dim their art rather than recolouring it. */}
              {focused ? <View style={styles.pill} /> : null}
              <Art name={meta.art} size={26} style={focused ? undefined : styles.dimmed} />
              <Text
                allowFontScaling={false}
                style={[
                  styles.label,
                  {
                    color: focused ? meta.tint : colors.inkMuted,
                    fontSize: 11 * fontScale,
                    lineHeight: Math.round(16 * fontScale),
                  },
                ]}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </PopSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  // Absolute so the scene fills the whole screen behind it and each screen's own
  // background reaches the bottom edge. `pointerEvents: box-none` on the wrapper
  // keeps the padding around the pill from swallowing taps meant for content.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pill: {
    position: 'absolute',
    top: -2,
    width: 44,
    height: 34,
    borderRadius: radii.pill,
    // Deep green at nearly a third opacity. At the old rgba(123, 193, 22, 0.18) the
    // pill was barely separable from the cream bar it sits on, so the focused tab
    // did not look focused; this reads as a pressed-in well behind the icon.
    backgroundColor: 'rgba(79, 125, 14, 0.30)',
  },
  dimmed: { opacity: 0.45 },
  label: {
    ...typography.caption,
    fontSize: 11,
    // "Library" lost its `y` here, and the cause was never settled — an earlier
    // attempt blamed horizontal advance-width clipping, added `paddingHorizontal`,
    // and changed nothing on device. So this gives the label room on *both* axes and
    // removes the clip that could enforce either:
    //
    //   - `lineHeight` well above the font size, so the descender has somewhere to go.
    //   - `paddingHorizontal` as ink room for a tail overhanging its advance width.
    //   - `clip={false}` on the `PopSurface` above, plus `LABEL_LINE` raised to 18.
    //
    // No `letterSpacing`, deliberately: Android appends tracking after the final
    // glyph, which only widens the gap between the ink and whatever clips it.
    //
    // `lineHeight` is not set here: the base value (16) is applied inline in the
    // component, scaled by the system font scale — a fixed line box around a
    // scaled font is itself a way to clip a descender.
    paddingHorizontal: 6,
  },
});
