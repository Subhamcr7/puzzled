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
 * current 1.2× scale (measured ≈ 138dp on the ci-30 debug build), with a few
 * points of margin for the widest digit set, so the box is exactly as big as it
 * already is — never smaller, never larger. The count and timer share the value
 * so the pair renders as two identical pills; the count's longest string
 * (`784/784`) also sits well inside it, so the box never grows as pieces are
 * placed.
 */
export const INFO_BOX_MIN_W = 144;

interface GameHeaderProps {
  /** Pieces already locked on the board. */
  locked: number;
  /** Expected total piece count for the grid. */
  total: number;
  /** Total milliseconds played, rendered as the clock. */
  elapsedMs: number;
  /** Whether the edges-highlight toggle is active. */
  highlightEdges: boolean;
  onBack: () => void;
  onHint: () => void;
  onEdges: () => void;
  onPreview: () => void;
  onPause: () => void;
}

/**
 * The game header, arranged in two rows.
 *
 * Row one: **Back** on the left; the piece-count and timer boxes grouped on the
 * right. Row two: **Hint, Edges, Preview, Pause** grouped in one shared rounded
 * tray on the right, sitting under the count/timer pair. Every control keeps
 * the 1.2× scaling from the UI pass — only the arrangement changed.
 */
export function GameHeader({
  locked,
  total,
  elapsedMs,
  highlightEdges,
  onBack,
  onHint,
  onEdges,
  onPreview,
  onPause,
}: GameHeaderProps) {
  const theme = useTheme();
  const styles = useStyles();

  const controls: {
    art: ArtName;
    label: string;
    active?: boolean;
    onPress: () => void;
  }[] = [
    { art: 'back', label: 'Back', onPress: onBack },
    { art: 'bulb', label: 'Hint', onPress: onHint },
    { art: 'edges', label: 'Edges', active: highlightEdges, onPress: onEdges },
    { art: 'eye', label: 'Preview', onPress: onPreview },
    { art: 'pause', label: 'Pause', onPress: onPause },
  ];

  return (
    <View style={styles.header} testID="game-header">
      <View style={styles.headerRow} testID="game-header-top">
        <View style={styles.headerGroup}>
          <HeaderRoundButton {...controls[0]} />
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

      {/* Row two sits in one shared rounded tray so Hint, Edges, Preview and
      Pause read as a single control group, right-aligned under the boxes. */}
      <PopSurface
        fill={theme.colors.surface}
        radius={radii.lg}
        elevation="card"
        style={styles.toolTray}
        contentStyle={styles.toolTrayContent}
        testID="tool-tray"
      >
        <View style={styles.headerRowEnd} testID="game-header-tools">
          {controls.slice(1).map((control) => (
            <HeaderRoundButton key={control.label} {...control} />
          ))}
        </View>
      </PopSurface>
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
      gap: spacing.xs,
    },
    // Row two: the four tool buttons grouped on the right under the boxes.
    headerRowEnd: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.xs,
    },
    // The tray that holds row two hugs the right edge instead of stretching
    // across the header, so the group sits directly below the count/timer pair.
    toolTray: {
      alignSelf: 'flex-end',
    },
    // Compact interior: one shared gap token between the buttons and a small
    // even padding so the tray is a tight rounded box, not a tall band.
    toolTrayContent: {
      padding: spacing.sm,
    },
    // The back, edges, preview and pause art are bare glyphs with no ground of
    // their own, so they need a surface behind them to read against the board's
    // pale green. Scaled 1.2× for the UI pass.
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
    // enough breathing room that the values never sit tight against the edges.
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs * HEADER_SCALE,
      paddingHorizontal: spacing.md * HEADER_SCALE,
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
