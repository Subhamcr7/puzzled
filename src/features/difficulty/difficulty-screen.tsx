import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgressRepository,
  getPuzzleById,
  resolvePuzzleImageSource,
  type PuzzleProgressSummary,
} from '@/data';
import { SUPPORTED_GRID_SIZES, type GridSize, type PuzzleDefinition } from '@/game-engine';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { radii, spacing, typography } from '@/shared/theme';
import { Art, PopButton, PopHeader, PopSurface, Text, ThemeGround } from '@/shared/ui';

import { PiecePicker } from './piece-picker';

/** The board the player touched last, so the picker can open on it. */
function mostRecent(rows: PuzzleProgressSummary[]): PuzzleProgressSummary | null {
  return rows.reduce<PuzzleProgressSummary | null>(
    (latest, row) => (latest == null || row.updatedAt > latest.updatedAt ? row : latest),
    null,
  );
}

export function DifficultyScreen({ puzzleId }: { puzzleId: string }) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [puzzle, setPuzzle] = useState<PuzzleDefinition | null>(null);
  const [image, setImage] = useState<number | string | null>(null);
  const [selected, setSelected] = useState<GridSize | null>(null);
  const [saved, setSaved] = useState<Map<GridSize, PuzzleProgressSummary>>(new Map());

  useEffect(() => {
    let active = true;
    (async () => {
      const [found, summaries] = await Promise.all([
        getPuzzleById(puzzleId),
        (await getProgressRepository()).listSummaries().catch(() => [] as PuzzleProgressSummary[]),
      ]);
      if (!active) return;

      // Every size of *this* puzzle the player has a board for. Boards are
      // stored per (puzzle, size), so two sizes of one image are two saves.
      const unfinished = summaries.filter(
        (row) => row.puzzleId === puzzleId && row.status !== 'completed',
      );
      setPuzzle(found);
      setImage(found ? resolvePuzzleImageSource(found) : null);
      setSaved(new Map(unfinished.map((row) => [row.gridSize, row])));
      // Land on the board they were last on rather than the definition's
      // default: arriving at a fresh 4x4 with a half-built 3x3 saved reads as
      // the progress having been thrown away, when it is simply another board.
      setSelected(mostRecent(unfinished)?.gridSize ?? found?.gridSize ?? 6);
    })();
    return () => {
      active = false;
    };
  }, [puzzleId]);

  const start = () => {
    if (!puzzle || selected == null) return;
    router.push({
      pathname: '/game/[puzzleId]',
      params: { puzzleId: puzzle.id, size: String(selected) },
    });
  };

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader title="Select Difficulty" onBack={() => router.back()} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* A cream frame around the artwork, matching the mockup's board and
              level cards — the photo is the hero, the chrome sits around it. */}
          <PopSurface
            fill={theme.colors.surface}
            radius={radii.lg}
            contentStyle={styles.previewFrame}
          >
            <View style={styles.previewBody}>
              {image != null ? (
                <Image
                  source={typeof image === 'number' ? image : { uri: image }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewFallback}>
                  <Art name="preview-image" size={72} />
                </View>
              )}
              {selected != null &&
                (() => {
                  const dim = Math.round(Math.sqrt(selected));
                  const lines = Array.from({ length: dim - 1 }, (_, i) => (i + 1) / dim);
                  return (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                      {lines.map((fraction, i) => {
                        const top: `${number}%` = `${fraction * 100}%`;
                        return (
                          <View key={`gh-${i}`}>
                            <View style={[styles.gridLineH, { top }]} />
                            <View style={[styles.gridLineV, { left: top }]} />
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
            </View>
          </PopSurface>

          <Text style={styles.puzzleTitle}>{puzzle?.title ?? 'Puzzle'}</Text>

          <View style={styles.pickerSpacer} />

          <PiecePicker
            sizes={SUPPORTED_GRID_SIZES}
            selected={selected}
            saved={saved}
            onSelect={setSelected}
          />
        </ScrollView>

        <View style={styles.footer}>
          <PopButton
            label={selected != null && saved.has(selected) ? 'Continue' : 'Start Puzzle'}
            tone="grass"
            onPress={start}
            disabled={!puzzle}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    // A cream margin around the artwork rather than a coloured ring.
    previewFrame: { padding: spacing.sm },
    previewBody: {
      height: 340,
      overflow: 'hidden',
      borderRadius: radii.md,
      backgroundColor: theme.colors.white,
    },
    previewImage: { width: '100%', height: '100%' },
    previewFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    gridLineH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: '#000',
      opacity: 0.3,
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: '#000',
      opacity: 0.3,
    },
    pickerSpacer: { height: spacing.md },
    puzzleTitle: { ...typography.title, color: theme.colors.headingGreen, textAlign: 'center' },
    // Bottom padding as well as top: without it the button sat flush against the
    // gesture bar.
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
  }),
);
