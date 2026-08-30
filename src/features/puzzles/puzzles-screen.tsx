import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgressRepository,
  getWalletRepository,
  listCatalog,
  resolvePuzzleImageSource,
  type PuzzleProgressSummary,
} from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, PopIcon, PopSurface, Text, ThemeGround, useTabBarSpace } from '@/shared/ui';

import { PuzzleTile } from './puzzle-tile';
import { tileBadge } from './tile-progress';

interface CatalogData {
  bundled: PuzzleDefinition[];
  user: PuzzleDefinition[];
  /** Saved sessions per puzzle, most recently played first. */
  byPuzzle: Record<string, PuzzleProgressSummary[]>;
  /** Current coin balance; `null` while unknown or unreadable. */
  coins: number | null;
}

const EMPTY: CatalogData = { bundled: [], user: [], byPuzzle: {}, coins: null };

/**
 * The Discover grid: every puzzle as one square artwork tile, image-first, with
 * the fewest controls a gallery can have. Same contract as the picker's home
 * screen — the picture is what you browse and tap.
 */
export function PuzzlesScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [data, setData] = useState<CatalogData>(EMPTY);
  const tabBarSpace = useTabBarSpace();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const { bundled, user } = await listCatalog();

        // Progress powers the badge over a tile, so it is read here rather than
        // left to each tile — same best-effort contract as Home
        // (`home-screen.tsx:95-116`): an unreadable database still lists images.
        const byPuzzle: Record<string, PuzzleProgressSummary[]> = {};
        try {
          const rows = await (await getProgressRepository()).listSummaries();
          for (const row of rows) {
            (byPuzzle[row.puzzleId] ??= []).push(row);
          }
        } catch {
          // Progress is best-effort; an unreadable database still lists puzzles.
        }

        let coins: number | null = null;
        try {
          coins = (await (await getWalletRepository()).balance()).coins;
        } catch {
          // No balance is better than a wrong one — the coins screen's contract.
        }

        if (active) setData({ bundled, user, byPuzzle, coins });
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  // The whole catalog as one flat grid. The bundled/user split still surfaces in
  // Library; here it would be a filter over a handful of tiles, which is chrome.
  const all = [...data.bundled, ...data.user];

  const open = (puzzle: PuzzleDefinition) =>
    router.push({ pathname: '/difficulty/[puzzleId]', params: { puzzleId: puzzle.id } });

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* The scroll frame stops above the floating dock rather than running
            under it. Content sliding beneath a bar that does not span the full
            width reads as two overlapping layers. */}
        <View style={[styles.scrollFrame, { paddingBottom: tabBarSpace }]}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>Puzzles</Text>

              {/* A tappable coin pill, mirroring Home's (`home-screen.tsx:250-268`)
                  but without its "+" affordance — the plus is Home's job and the
                  shop is one tap deeper from here either way. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${data.coins ?? 'Unknown'} coins. Get more.`}
                onPress={() => router.push('/coins')}
                style={styles.coinPill}
              >
                <Art name="coin" size={26} />
                <Text style={styles.coinText} numberOfLines={1}>
                  {data.coins ?? '—'}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() =>
                router.push({ pathname: '/pack/[packId]', params: { packId: 'starter' } })
              }
              accessibilityRole="button"
              accessibilityLabel="Browse the Starter Pack"
            >
              <PopSurface
                fill={theme.colors.honey}
                radius={radii.md}
                contentStyle={styles.packFrame}
              >
                <View style={styles.packBody}>
                  <Art name="collection" size={30} />
                  <View style={styles.packCopy}>
                    <Text style={styles.packTitle}>Starter Pack</Text>
                    <Text style={styles.packMeta}>Every puzzle bundled with Puzzled</Text>
                  </View>
                  <PopIcon name="chevron" size={20} color={theme.colors.inkMuted} />
                </View>
              </PopSurface>
            </Pressable>

            <View style={styles.grid}>
              {all.map((puzzle, index) => (
                <PuzzleTile
                  key={puzzle.id}
                  title={puzzle.title}
                  source={resolvePuzzleImageSource(puzzle)}
                  badge={tileBadge(data.byPuzzle[puzzle.id] ?? [])}
                  index={index}
                  onPress={() => open(puzzle)}
                />
              ))}

              {all.length === 0 ? <Text style={styles.empty}>No puzzles to show yet.</Text> : null}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    /** Ends where the dock begins, so nothing scrolls underneath it. */
    scrollFrame: { flex: 1 },
    safe: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pageTitle: { ...typography.title, color: theme.colors.headingGreen },
    coinPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingLeft: spacing.sm,
      paddingRight: spacing.lg,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: theme.colors.surface,
    },
    coinText: { ...typography.label, color: theme.colors.ink },
    // Inset padding on the coloured `PopSurface` face, so a ring of `fill` shows
    // as a frame around the white body nested inside it.
    packFrame: { padding: spacing.xs },
    packBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: theme.colors.surface,
    },
    packCopy: { flex: 1, gap: 2 },
    packTitle: { ...typography.heading, fontSize: 17, color: theme.colors.ink },
    packMeta: { ...typography.caption, color: theme.colors.inkMuted },
    /**
     * Two columns, gutter by `space-between` rather than `gap`: two 48% cells
     * plus a real gap can overflow the row on RN. Each tile's own `width: '48%'`
     * comes from `puzzle-tile.tsx`, so the grid only needs the spacing.
     */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: spacing.md,
    },
    empty: { ...typography.body, color: theme.colors.inkMuted },
  }),
);
