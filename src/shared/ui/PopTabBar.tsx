import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type ArtName } from '@/shared/art';
import { FONT_SCALE } from '@/shared/font-scale';
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
 * Vertical room for the label line, scaled by the same startup constant as the
 * label itself so the bar grows with the text instead of being overflowed by it.
 *
 * 18 rather than the 14 this used to be: an 11pt Nunito Bold line box is taller
 * than 11pt once Android's `includeFontPadding` is counted, so 14 left the
 * descender hanging outside the budget.
 */
const LABEL_LINE = Math.round(18 * FONT_SCALE);
const ITEM_GAP = 2;
const BAR_HEIGHT = spacing.sm + ICON_SIZE + ITEM_GAP + LABEL_LINE + spacing.xs;

/**
 * Tab-label text style, with the startup font scale baked in. Module-level and
 * therefore identity-stable across renders — see `@/shared/font-scale` for why
 * these values must never change after mount.
 */
const SCALED_LABEL = {
  fontSize: 11 * FONT_SCALE,
  lineHeight: Math.round(16 * FONT_SCALE),
};

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
                  SCALED_LABEL,
                  { color: focused ? meta.tint : colors.inkMuted },
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
    // "Library" rendered as "Librar" because the family was still loading when
    // Fabric measured this line: the box was sized for the fallback face and
    // painted with Nunito, which is wider. The families are embedded at build
    // time now (`src/shared/fonts.test.ts`), so measure and paint agree.
    //
    // The room below is kept regardless — a descender needs somewhere to go, and
    // a glyph can overhang its advance width:
    //
    //   - `lineHeight` above the font size, from the module-level `SCALED_LABEL`.
    //   - `paddingHorizontal` as ink room at both ends.
    //   - `clip={false}` on the `PopSurface` above.
    //
    // No `letterSpacing`, deliberately: Android appends tracking after the final
    // glyph, which only widens the gap between the ink and whatever clips it.
    paddingHorizontal: 6,
  },
});
