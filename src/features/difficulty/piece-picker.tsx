import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { type PuzzleProgressSummary } from '@/data';
import { expectedPieceCount, type GridSize } from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { createThemedStyles } from '@/shared/themed-styles';
import { fonts, radii, shadow, spacing, typography } from '@/shared/theme';
import { Art, Text } from '@/shared/ui';

import { indexForOffset, offsetForIndex, pickerGeometry, snapOffsets } from './picker-geometry';

/** Difficulty word for a grid size, mirroring the tiers in the mockup. */
function tierFor(size: GridSize): string {
  if (size <= 4) return 'Easy';
  if (size <= 7) return 'Medium';
  return 'Hard';
}

/**
 * Piece art per tier. The asset set ships green, yellow and brown pieces, so the
 * tiers map onto them in ascending difficulty.
 */
function pieceArtFor(size: GridSize): ArtName {
  if (size <= 4) return 'puzzle-green';
  if (size <= 7) return 'puzzle-yellow';
  return 'puzzle-brown';
}

export interface PiecePickerProps {
  sizes: readonly GridSize[];
  selected: GridSize | null;
  saved: ReadonlyMap<GridSize, PuzzleProgressSummary>;
  onSelect: (size: GridSize) => void;
}

/**
 * Container width assumed before the strip is laid out — enough to pick sane
 * snap offsets on the first frame, replaced by the measured width in `onLayout`.
 */
const FALLBACK_CONTAINER_WIDTH = 393;

/**
 * The piece-count selector: a horizontal carousel instead of the two-column
 * grid. The item under the strip's centre is the selected size; a tap or a
 * flick settles it there. The swipe and the tap both drive `onSelect`, so the
 * screen's `selected` always tracks the centred item.
 */
export function PiecePicker({ sizes, selected, saved, onSelect }: PiecePickerProps) {
  const styles = useStyles();
  const stripRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  // The size the strip is currently centred on, as an index. `selected` from the
  // parent is the source of truth for *which* size; this is only so an external
  // change (progress resolving after mount) can steer the strip without fighting
  // a swipe that is already happening.
  const centredRef = useRef<number>(-1);

  const geometry = pickerGeometry(containerWidth ?? FALLBACK_CONTAINER_WIDTH);

  const selectIndex = (index: number) => {
    centredRef.current = index;
    onSelect(sizes[index]);
  };

  // Top-of-parent changes to `selected` (the screen opening on the player's most
  // recent board) spring the strip to that size. Swipe- and tap-driven changes
  // already match `centredRef`, so they are ignored rather than fought.
  useEffect(() => {
    if (selected == null) return;
    const index = sizes.indexOf(selected);
    if (index < 0 || index === centredRef.current) return;
    centredRef.current = index;
    stripRef.current?.scrollTo({ x: offsetForIndex(index, geometry), animated: false });
  }, [selected, geometry, sizes]);

  const handleScroll = (event: { nativeEvent: { contentOffset?: { x?: number } } }) => {
    const offset = event.nativeEvent.contentOffset?.x ?? 0;
    const index = indexForOffset(offset, geometry, sizes.length);
    if (index !== centredRef.current) {
      selectIndex(index);
    }
  };

  const handlePress = (index: number) => {
    if (index !== centredRef.current) {
      selectIndex(index);
    }
    stripRef.current?.scrollTo({ x: offsetForIndex(index, geometry), animated: true });
  };

  return (
    <ScrollView
      ref={stripRef}
      horizontal
      testID="piece-picker"
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      disableIntervalMomentum
      snapToOffsets={snapOffsets(sizes.length, geometry)}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.strip, { paddingHorizontal: geometry.sidePadding }]}
    >
      {sizes.map((size, index) => {
        const active = size === selected;
        const board = saved.get(size);
        return (
          <Pressable
            key={size}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              board
                ? `${expectedPieceCount(size)} pieces, ${tierFor(size)}, ` +
                  `${board.lockedPieces} of ${board.totalPieces} already placed`
                : `${expectedPieceCount(size)} pieces, ${tierFor(size)}`
            }
            onPress={() => handlePress(index)}
            style={{ width: geometry.itemWidth }}
          >
            <View style={styles.itemBody}>
              <Art name={pieceArtFor(size)} size={40} />
              <View style={styles.countArea}>
                {active ? (
                  <View style={styles.countBox}>
                    <Text style={styles.countActive}>{expectedPieceCount(size)}</Text>
                    <Text style={styles.piecesLabel}>PIECES</Text>
                  </View>
                ) : (
                  <Text style={styles.countIdle}>{expectedPieceCount(size)}</Text>
                )}
              </View>
            </View>
            {/* A fixed-height caption keeps every item the same height, so the
                strip's vertical centre — and the centred selection — does not
                wander between items. Only the centred size wears it. */}
            <View style={styles.captionArea}>
              {active ? (
                <Text style={styles.tier} numberOfLines={1}>
                  {tierFor(size)} · {size}×{size}
                </Text>
              ) : null}
              {active && board ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>
                    {board.lockedPieces}/{board.totalPieces}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.xs,
    },
    itemBody: { alignItems: 'center', gap: spacing.xs },
    // Fixed-height so the strip's vertical centre (and the centred selection)
    // does not wander between the selected box and idle numbers.
    countArea: {
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The selected size: a rounded-square container holding the count and the
    // word "PIECES", emphasised while idle counts stay slim and muted.
    countBox: {
      borderWidth: 3,
      borderColor: theme.colors.headingGreen,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      boxShadow: shadow.card,
    },
    // The selected size leads: bigger, in the heading green of the mockup's
    // chosen tile — which the grid expressed with a grass fill.
    countActive: {
      fontFamily: fonts.displayBold,
      fontSize: 34,
      letterSpacing: -0.3,
      color: theme.colors.headingGreen,
    },
    piecesLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1.2,
      color: theme.colors.headingGreen,
      marginTop: -2,
    },
    countIdle: { fontSize: 26, fontFamily: fonts.displayBold, color: theme.colors.inkMuted },
    captionArea: {
      height: 22,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    tier: { ...typography.label, color: theme.colors.inkMuted },
    pill: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      borderRadius: radii.sm,
      backgroundColor: theme.colors.honey,
    },
    pillText: { ...typography.label, fontSize: 11, color: theme.colors.ink },
  }),
);
