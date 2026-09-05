import { Image, Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, EnterView, PopIcon, PopSurface, Text } from '@/shared/ui';

import { type TileBadge } from './tile-progress';

interface PuzzleTileProps {
  /** Straight from `resolvePuzzleImageSource`: a require() id, a uri, or nothing. */
  source: number | string | null;
  badge: TileBadge | null;
  /** Position in the grid — drives the entrance stagger and the fallback tint. */
  index: number;
  onPress: () => void;
}

/**
 * One cell of the Discover grid: the artwork, and as little else as possible.
 *
 * This replaces `StarterRow`, which was a 68pt thumbnail beside two lines of
 * metadata and a Start button. Two things were wrong with that. The picture —
 * the only thing that tells you whether you want to solve it — was the smallest
 * element in the row. And only the button was pressable, so tapping the image
 * did nothing, which is the first thing anyone tries.
 *
 * So: the image is the control. No Start button, no piece-count copy, no
 * "Choose 3×3 up to 10×10" — that sentence belongs on the screen the tap opens,
 * and it is already there as the picker itself.
 */
export function PuzzleTile({ source, badge, index, onPress }: PuzzleTileProps) {
  const theme = useTheme();
  const styles = useStyles();

  // A visual gallery announces the picture, not the name: the artwork itself is
  // the identity, and the app keeps puzzle titles for the places that need them
  // (navigation, game logic). The label stays title-free and reads the state a
  // sighted player gets from the badge alone.
  const label =
    badge == null
      ? 'Puzzle image. Double tap to select.'
      : badge.kind === 'completed'
        ? 'Puzzle image, completed. Double tap to select.'
        : `Puzzle image, ${badge.percent}% complete. Double tap to select.`;

  return (
    <EnterView index={index} style={styles.tile}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        {/* `PopSurface`'s face is already `overflow: hidden`
            (`PopSurface.tsx:70`), so the artwork is clipped to the corner radius
            without this having to restate it. */}
        <PopSurface fill={theme.colors.surface} radius={radii.lg} contentStyle={styles.frame}>
          <View style={[styles.imageWrap, { backgroundColor: fallbackTint(theme, index) }]}>
            {source != null ? (
              <Image
                testID="puzzle-tile-image"
                source={typeof source === 'number' ? source : { uri: source }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View testID="puzzle-tile-fallback" style={styles.fallback}>
                <Art name="puzzle-quad" size={44} />
              </View>
            )}

            {badge != null ? (
              <View
                testID="puzzle-tile-badge"
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      badge.kind === 'completed'
                        ? theme.colors.headingGreen
                        : theme.colors.grassDeep,
                  },
                ]}
              >
                {badge.kind === 'completed' ? (
                  <PopIcon name="check" size={14} color={theme.colors.onFill} />
                ) : (
                  <Text style={styles.badgeText}>{badge.percent}%</Text>
                )}
              </View>
            ) : null}
          </View>
        </PopSurface>
      </Pressable>
    </EnterView>
  );
}

/**
 * The tint behind a puzzle with no resolvable image.
 *
 * Read off the live theme rather than `accentAt()` from `tokens.ts`, because that
 * ramp is module-scope hex captured at import and would keep the meadow's
 * brights after a theme switch — the exact binding `theme-context.tsx:8-17`
 * warns about. Indexed so a column of missing images is not one flat slab.
 */
function fallbackTint(theme: ReturnType<typeof useTheme>, index: number): string {
  const ramp = [theme.colors.honey, theme.colors.sky, theme.colors.blossom, theme.colors.apricot];
  return ramp[((index % ramp.length) + ramp.length) % ramp.length];
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    /**
     * The column width lives here rather than on the grid container. Percentage
     * widths and `columnGap` fight each other in RN — two 48% cells plus a gap
     * can overflow the row and drop the second tile — so the 4% left over is
     * spent by the parent's `justifyContent: 'space-between'` instead.
     */
    tile: { width: '48%' },
    /** No padding: the image runs to the tile's edge, which is the whole design. */
    frame: { padding: 0 },
    /**
     * Square, because every bundled asset is square or near it (1024×1024 and
     * 736×736/760, `local-puzzle-repository.ts:5-62`). A fixed height would crop
     * differently on every screen width; an aspect ratio never does.
     */
    imageWrap: { width: '100%', aspectRatio: 1 },
    image: { width: '100%', height: '100%' },
    fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      minWidth: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    badgeText: { ...typography.label, fontSize: 10, color: theme.colors.onFill },
  }),
);
