import { Pressable, StyleSheet, View } from 'react-native';

import { type ArtName } from '@/shared/art';
import { radii, shadow, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, PopSurface, Text } from '@/shared/ui';

import { formatClock } from './play-clock';

/**
 * The UI pass made every game-header control 20% larger while keeping the row a
 * single line. Applied to button size, art, text and box padding; the gaps
 * between controls stay on the spacing scale so the row never crowds the board.
 */
export const HEADER_SCALE = 1.2;

/**
 * The count and timer boxes keep one fixed minimum width so their outer
 * geometry is independent of the string rendered inside — and identical to each
 * other's.
 *
 * Before this, both boxes were sized by their content. The clock and count
 * digits come from Fredoka, a proportional face, so every tick re-measured the
 * pill: the right edge travelled with the seconds — `00:09→00:10` narrows the
 * string, `00:59→01:00` widens it — which read as the box stretching and
 * leaning toward the right. Pinning `minWidth` + centring the content decouples
 * the box shape from the changing text entirely.
 *
 * `INFO_BOX_MIN_W` matches the pill's natural width for an `mm:ss` value at the
 * current 1.2× scale, with a few points of margin for the widest digit set. The
 * timer's full content (`⏱ 10:00` ≈ 87–92dp at 1.2×) is the widest the pair
 * must fit; with balanced horizontal padding (≈ 4.8dp per side) the shared width
 * settles at 104dp — visibly tighter than the older 120dp, but still a touch
 * larger than the widest content so the box never re-measures or clips as the
 * clock and count change. The count and timer share the value so the pair
 * renders as two identical pills; the count's longest string (`784/784`) also
 * sits well inside it.
 */
export const INFO_BOX_MIN_W = 104;

/** Horizontal gap between the two pills inside `headerGroup`. */
export const INFO_BOX_GAP = spacing.xs;

interface GameHeaderProps {
  /** Pieces already locked on the board. */
  locked: number;
  /** Expected total piece count for the grid. */
  total: number;
  /** Total milliseconds played, rendered as the clock. */
  elapsedMs: number;
  onBack: () => void;
}

/**
 * The game header: **Back** on the left; the piece-count and timer boxes
 * grouped on the right. Every control keeps the 1.2× scaling from the UI pass.
 *
 * The four tool buttons (Hint, Edges, Preview, Pause) are rendered separately
 * by the parent, placed between the header and the board.
 */
export function GameHeader({ locked, total, elapsedMs, onBack }: GameHeaderProps) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.header} testID="game-header">
      <View style={styles.headerRow} testID="game-header-top">
        <View style={styles.headerGroup}>
          <HeaderRoundButton art="back" label="Back" onPress={onBack} />
        </View>
        <View style={styles.headerGroup}>
          <PopSurface
            fill={theme.colors.surface}
            radius={radii.pill}
            contentStyle={[styles.infoBox, styles.infoBoxFixed]}
            testID="count-box"
          >
            <Text style={styles.pieceCount} numberOfLines={1}>
              {locked}/{total}
            </Text>
          </PopSurface>
          <PopSurface
            fill={theme.colors.surface}
            radius={radii.pill}
            contentStyle={[styles.infoBox, styles.infoBoxFixed]}
            testID="timer-box"
          >
            <Art name="clock" size={16 * HEADER_SCALE} />
            <Text style={styles.clock} numberOfLines={1}>
              {formatClock(elapsedMs)}
            </Text>
          </PopSurface>
        </View>
      </View>
    </View>
  );
}

function HeaderRoundButton({
  art,
  label,
  active,
  onPress,
}: {
  art: ArtName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={10}
      onPress={onPress}
      style={styles.headerRoundButton}
    >
      <PopSurface
        fill={active ? theme.colors.honey : theme.colors.surface}
        radius={radii.md}
        elevation="card"
        contentStyle={styles.toolIconInner}
      >
        <Art name={art} size={24 * HEADER_SCALE} />
      </PopSurface>
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: spacing.sm,
    },
    // Row one: Back pinned left, the count/timer pair pinned right.
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    headerGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: INFO_BOX_GAP,
    },
    // The back button needs a surface behind it to read against the board's pale
    // green. Scaled 1.2× for the UI pass.
    headerRoundButton: {
      width: 32 * HEADER_SCALE,
      height: 32 * HEADER_SCALE,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.pill,
      backgroundColor: theme.colors.surface,
      boxShadow: shadow.card,
    },
    pieceCount: {
      ...typography.heading,
      fontSize: 16 * HEADER_SCALE,
      color: theme.colors.headingGreen,
      // Centred inside the fixed-width box, and tabular so the digits do not
      // jitter as the progress counts up.
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    // The count and timer share one box style so they read as a matching pair:
    // same height, same internal padding, rounded pills, content centred with
    // balanced horizontal breathing room (compact — not a wide empty pill).
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs * HEADER_SCALE,
      paddingHorizontal: spacing.xs * HEADER_SCALE,
      paddingVertical: 6 * HEADER_SCALE,
    },
    // Both pills share the one fixed minimum width, so their outer geometry is
    // identical and content-independent.
    infoBoxFixed: {
      minWidth: INFO_BOX_MIN_W,
    },
    clock: {
      ...typography.heading,
      fontSize: 16 * HEADER_SCALE,
      color: theme.colors.ink,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    toolIconInner: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xs * HEADER_SCALE,
    },
  }),
);
