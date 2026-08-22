import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getWalletRepository, listCatalog } from '@/data';
import { type PuzzleDefinition } from '@/game-engine';
import { type ArtName } from '@/shared/art';
import { colors, radii, shadow, spacing, typography } from '@/shared/theme';
import {
  Art,
  EnterView,
  IdleBob,
  PopButton,
  PopSurface,
  PressDarken,
  WordmarkTitle,
  usePressProgress,
  useTabBarSpace,
} from '@/shared/ui';

const HOME_BACKGROUND = require('../../../assets/backgrounds/home.png');

/**
 * Bear size, in points. Kept equal to `imageWidth` on the splash screen in
 * `app.json`, so the mascot is the same size before and after the app loads and
 * does not visibly re-draw on launch.
 */
const MASCOT_SIZE = 254;

interface HomeData {
  /** First puzzle the Play button can start. */
  firstPlayable: PuzzleDefinition | null;
  /** Null rather than a fabricated zero when the wallet cannot be read. */
  coins: number | null;
}

const EMPTY: HomeData = { firstPlayable: null, coins: null };

async function loadHomeData(): Promise<HomeData> {
  const { bundled, user } = await listCatalog();

  let coins: number | null = null;
  try {
    coins = (await (await getWalletRepository()).balance()).coins;
  } catch {
    // Same contract as the shop: no balance is better than a wrong one.
  }

  return { firstPlayable: bundled[0] ?? user[0] ?? null, coins };
}

/**
 * Home is deliberately only what the team's mockup shows: the meadow, the coin
 * balance, the logo, the mascot, and its actions.
 *
 * Progress moved to `statistics`, the starter list to `puzzles`, and photo import
 * to `library`'s My Photos tab — each to the screen that already owns that data.
 * Home previously carried all of it and read as a dashboard rather than a
 * landing screen.
 *
 * The "My Album" tile is gone too, on request. It was only a second route into
 * `library`, which the tab bar already reaches from every screen.
 */
export function HomeScreen() {
  const [data, setData] = useState<HomeData>(EMPTY);
  const router = useRouter();
  const tabBarSpace = useTabBarSpace();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadHomeData().then((next) => {
        if (active) setData(next);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const { firstPlayable } = data;

  return (
    // One cover-fitted image rather than stacked colour bands. The bands could
    // never line up with scrolling content, which is what made the old seam cut
    // across cards.
    <ImageBackground source={HOME_BACKGROUND} resizeMode="cover" style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <View style={styles.coinPill}>
            <Art name="coin" size={26} />
            <Text style={styles.coinText}>{data.coins ?? '—'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={styles.gearButton}
          >
            <Art name="gear" size={26} />
          </Pressable>
        </View>

        {/* Logo, mascot then actions rise in that order, which is also the order
            the eye should read them. The bear keeps breathing afterwards — sitting
            perfectly still is what made it read as a sticker rather than a mascot. */}
        <View style={[styles.body, { paddingBottom: tabBarSpace }]}>
          <EnterView index={0}>
            <WordmarkTitle />
          </EnterView>

          {/* The mascot absorbs the slack between logo and actions, so the
              layout holds on both short and tall screens. */}
          <EnterView index={1} style={styles.mascotWrap}>
            <IdleBob distance={9} sway={2}>
              <Art name="bear" size={MASCOT_SIZE} />
            </IdleBob>
          </EnterView>

          <EnterView index={2} style={styles.actions}>
            <PopButton
              label="Play"
              tone="lime"
              size="lg"
              icon={<Art name="play" size={28} />}
              style={styles.fullWidth}
              disabled={!firstPlayable}
              onPress={() => {
                if (firstPlayable) {
                  router.push({
                    pathname: '/difficulty/[puzzleId]',
                    params: { puzzleId: firstPlayable.id },
                  });
                }
              }}
            />

            <QuickLink art="calendar" label="Daily Puzzle" onPress={() => router.push('/daily')} />
          </EnterView>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

function QuickLink({ art, label, onPress }: { art: ArtName; label: string; onPress: () => void }) {
  const { progress, pressHandlers } = usePressProgress();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...pressHandlers}
      style={styles.quickLink}
    >
      <PopSurface fill={colors.surface} radius={radii.md} clip={false}>
        {/* Icon above the label rather than beside it, matching `PopTabBar`.
            Side by side, the fixed 30pt icon and its gap ate into the label's
            width, and the label was the thing that then got squeezed.

            The tile is now full width — Play's own edges — so "Daily Puzzle" has
            roughly 340pt for a word that needs about 95pt at 14pt. There is no
            width pressure left to manage, which is why there is no `numberOfLines`
            and no `flexShrink` here: nothing should ever be truncating this, and if
            an extreme font scale does wrap it, two full lines beat one cut word.

            `clip={false}` for the same reason as the tab bar: the surface's clip
            cuts descenders, and nothing in this tile needs clipping to the radius. */}
        <View style={styles.quickLinkInner}>
          <PressDarken progress={progress} radius={radii.md} />
          <Art name={art} size={30} />
          <Text style={styles.quickLinkLabel}>{label}</Text>
        </View>
      </PopSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  coinText: { ...typography.heading, fontSize: 18, color: colors.ink },
  gearButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    boxShadow: shadow.card,
  },
  // No ScrollView: Home now fits one screen by design. The logo sits high, the
  // mascot takes the slack, and the actions are pinned to the bottom.
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  mascotWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  // Full width, so the tile shares Play's exact edges. It was `flex: 1` inside a
  // two-tile row until "My Album" was removed; alone in the column it stretches.
  quickLink: { alignSelf: 'stretch' },
  quickLinkInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  // `lineHeight` and `paddingHorizontal` are room for the glyphs, not spacing — see
  // the note on `PopButton`'s `label`. `textAlign` because the label may wrap.
  quickLinkLabel: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
    paddingHorizontal: 6,
    textAlign: 'center',
  },
});
