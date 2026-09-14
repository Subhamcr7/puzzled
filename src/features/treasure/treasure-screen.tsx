import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import {
  dateKey,
  getCompletionsRepository,
  getWalletRepository,
  listCatalog,
  pickDailyPuzzle,
  resolvePuzzleImageSource,
} from '@/data';
import { radii, spacing, typography } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { createThemedStyles } from '@/shared/themed-styles';
import { Art, PopButton, PopHeader, PopSurface, Text, ThemeGround } from '@/shared/ui';
import { playUiTap } from '@/shared/ui/ui-sound';

import {
  TREASURE_STOPS,
  treasureProgress,
  treasureRewardForStop,
  treasureStopDayKey,
  treasureTierForStop,
  type TreasureProgress,
} from './treasure';

/**
 * The daily treasure hunt: a seven-stop map you walk by finishing the day's
 * challenge.
 *
 * The map is drawn rather than illustrated — the trail is SVG and the stops are
 * views laid over it — so it re-colours with the theme and needs no art of its
 * own beyond the chest. That matters more than it sounds: a painted map would
 * have to be redrawn for every theme, and would be the one screen that quietly
 * stayed in the meadow's palette.
 */

/** Stop positions in the map's own coordinate space, bottom-left to top-right. */
const MAP_W = 300;
const MAP_H = 380;
const NODES = [
  { x: 44, y: 338 },
  { x: 150, y: 296 },
  { x: 254, y: 250 },
  { x: 150, y: 200 },
  { x: 48, y: 152 },
  { x: 152, y: 104 },
  { x: 250, y: 52 },
];

/** Diameter of a stop marker, in points. */
const NODE = 46;

interface HuntData extends TreasureProgress {
  coins: number | null;
  /** Per-stop artwork source, index 0 = stop 1. `resolvePuzzleImageSource`'s contract. */
  images: (number | string | null)[];
}

const EMPTY: HuntData = {
  streak: 0,
  stop: 0,
  doneToday: false,
  completedDays: [],
  coins: null,
  images: [],
};

async function loadHunt(todayKey: string): Promise<HuntData> {
  const { bundled, user } = await listCatalog();
  const pool = [...bundled, ...user];

  let completions: Awaited<
    ReturnType<Awaited<ReturnType<typeof getCompletionsRepository>>['list']>
  > = [];
  try {
    completions = await (await getCompletionsRepository()).list();
  } catch {
    // An unreadable log means an empty map, not a broken screen.
  }

  let coins: number | null = null;
  try {
    coins = (await (await getWalletRepository()).balance()).coins;
  } catch {
    // Same contract as everywhere else: no balance beats a wrong one.
  }

  const progress = treasureProgress(pool, completions, todayKey);
  const images: (number | string | null)[] = [];
  for (let stop = 1; stop <= TREASURE_STOPS; stop += 1) {
    const day = treasureStopDayKey(progress, todayKey, stop);
    const puzzle = day ? pickDailyPuzzle(pool, day) : null;
    images.push(puzzle ? resolvePuzzleImageSource(puzzle) : null);
  }

  return { ...progress, coins, images };
}

export function TreasureScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const [data, setData] = useState<HuntData>(EMPTY);
  const [today, setToday] = useState(() => dateKey(new Date()));
  /** Measured map width, so stops can be placed against the real size. */
  const [mapWidth, setMapWidth] = useState(0);
  /** The map's top inside the ScrollView's content, for auto-scrolling to the current stop. */
  const [mapTop, setMapTop] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  /** The stop the map has already been scrolled to, so navigation only moves once. */
  const scrolledToRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const now = dateKey(new Date());
      if (now !== today) {
        // Crossing midnight with the app open would otherwise leave the map on
        // yesterday's stop and refuse today's reward.
        setToday(now);
        return () => {
          active = false;
        };
      }
      loadHunt(today).then((next) => {
        if (!active) {
          return;
        }
        setData(next);
        if (next.doneToday && next.stop > 0) {
          // Paid on sight rather than claimed: there is nothing to decide, and
          // `recordOnce` keyed on the day makes returning to this screen
          // harmless. A player who never opens it is paid the next time they do.
          void (async () => {
            try {
              await (
                await getWalletRepository()
              ).recordOnce({
                deltaCoins: treasureRewardForStop(next.stop),
                deltaHints: 0,
                reason: 'treasure-stop',
                ref: today,
              });
            } catch {
              // Best-effort; the next visit tries again.
            }
          })();
        }
      });
      return () => {
        active = false;
      };
    }, [today]),
  );

  const mapHeight = mapWidth * (MAP_H / MAP_W);
  const onMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, y } = event.nativeEvent.layout;
    setMapWidth((current) => (Math.abs(current - width) < 1 ? current : width));
    setMapTop(y);
  }, []);

  // Bring the stop the player stands on into view. The map is a tall SVG trail,
  // and without this the current stop can sit below the fold on first visit —
  // the player reads a header about a stop they cannot see. It fires once per
  // stop: afterwards the player's own scrolling owns the viewport.
  useEffect(() => {
    if (mapWidth <= 0 || data.stop <= 0 || data.stop > NODES.length) {
      return;
    }
    if (scrolledToRef.current === data.stop) {
      return;
    }
    scrolledToRef.current = data.stop;
    const node = NODES[data.stop - 1];
    const nodeY = mapTop + node.y * (mapWidth / MAP_W);
    // Fire-and-forget like the audio calls: an unmeasured scroll target must
    // never interrupt the map render.
    scrollRef.current?.scrollTo?.({ y: Math.max(0, nodeY - NODE), animated: true });
  }, [data.stop, mapWidth, mapTop]);

  const scale = mapWidth / MAP_W;
  const currentTier = data.stop >= 1 ? treasureTierForStop(data.stop) : 'Easy';
  const nextReward = treasureRewardForStop(
    data.stop >= TREASURE_STOPS ? 1 : Math.max(1, data.stop + 1),
  );

  return (
    <View style={styles.root}>
      <ThemeGround />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PopHeader
          title="Treasure Hunt"
          onBack={() => router.back()}
          right={
            <View style={styles.balance}>
              <Art name="coin" size={22} />
              <Text style={styles.balanceText} numberOfLines={1}>
                {data.coins ?? '—'}
              </Text>
            </View>
          }
        />

        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          <PopSurface fill={theme.colors.surface} radius={radii.lg} contentStyle={styles.mapCard}>
            <View style={styles.mapHead}>
              <Text style={styles.mapTitle}>
                {data.streak === 0
                  ? 'Start the trail'
                  : `Day ${data.streak} — stop ${data.stop} of ${TREASURE_STOPS} · ${currentTier}`}
              </Text>
              <Text style={styles.mapMeta}>
                {data.doneToday
                  ? `Today’s stop paid ${treasureRewardForStop(data.stop)} coins. Next one is ${nextReward}.`
                  : `Finish today’s challenge to reach the next stop — ${nextReward} coins.`}
              </Text>
            </View>

            <View
              testID="treasure-map"
              style={[styles.map, { height: mapHeight }]}
              onLayout={onMapLayout}
            >
              {mapWidth > 0 ? (
                <>
                  {/* The trail, one segment per pair so the walked part can be
                      coloured without splitting a single path. */}
                  <Svg width={mapWidth} height={mapHeight} style={StyleSheet.absoluteFill}>
                    {NODES.slice(0, -1).map((from, index) => {
                      const to = NODES[index + 1];
                      const walked = index + 2 <= data.stop;
                      return (
                        <Line
                          key={index}
                          x1={from.x * scale}
                          y1={from.y * scale}
                          x2={to.x * scale}
                          y2={to.y * scale}
                          stroke={walked ? theme.colors.grass : theme.colors.locked}
                          strokeWidth={6}
                          strokeLinecap="round"
                          // A dotted trail, the way a map draws a route.
                          strokeDasharray="1 16"
                          opacity={walked ? 1 : 0.55}
                        />
                      );
                    })}
                  </Svg>

                  {NODES.map((node, index) => {
                    const stop = index + 1;
                    const reached = stop <= data.stop;
                    const current = stop === data.stop;
                    const isChest = stop === TREASURE_STOPS;
                    const image = data.images[stop - 1] ?? null;
                    const tier = treasureTierForStop(stop);
                    const label = reached
                      ? current
                        ? `Stop ${stop} of ${TREASURE_STOPS}, ${tier} difficulty, current level`
                        : `Stop ${stop} of ${TREASURE_STOPS}, ${tier} difficulty, reached`
                      : `Stop ${stop} of ${TREASURE_STOPS}, ${tier} difficulty, ${treasureRewardForStop(stop)} coins, locked`;

                    const art = isChest ? (
                      <Art name={reached ? 'chest-open' : 'chest'} size={30} />
                    ) : image != null ? (
                      <Image
                        source={typeof image === 'number' ? image : { uri: image }}
                        style={[styles.nodeImage, !reached && styles.nodeImageLocked]}
                        resizeMode="cover"
                      />
                    ) : (
                      <Art name="puzzle-quad" size={22} />
                    );

                    const nodeStyle = [
                      styles.node,
                      {
                        left: node.x * scale - NODE / 2,
                        top: node.y * scale - NODE / 2,
                        backgroundColor: reached
                          ? theme.colors.grass
                          : isChest
                            ? theme.colors.honey
                            : theme.colors.paper,
                      },
                      !reached && !isChest && styles.nodeLocked,
                      current && styles.nodeCurrent,
                    ];

                    return reached ? (
                      <Pressable
                        key={stop}
                        accessibilityRole="button"
                        accessibilityLabel={label}
                        onPress={() => {
                          playUiTap();
                          // A reached stop from an earlier day replays from the
                          // gallery (a tab beneath this screen, so it unwinds
                          // rather than stacking); the current stop is today's
                          // challenge.
                          router.push(current ? '/daily' : '/puzzles');
                        }}
                        style={nodeStyle}
                      >
                        {art}
                      </Pressable>
                    ) : (
                      <View
                        key={stop}
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={label}
                        style={nodeStyle}
                      >
                        {art}
                        {!isChest ? (
                          <View style={styles.lockBadge}>
                            <Art name="lock" size={14} />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </>
              ) : null}
            </View>
          </PopSurface>

          <PopButton
            label={data.doneToday ? 'Play another puzzle' : 'Play today’s challenge'}
            tone="grass"
            icon={<Art name={data.doneToday ? 'puzzle-quad' : 'play'} size={24} />}
            // `/puzzles` is a tab beneath this screen, so it unwinds to it rather
            // than stacking a second tab navigator over the map; `/daily` is a
            // stack screen and pushes normally, so back returns here.
            onPress={() => (data.doneToday ? router.dismissTo('/puzzles') : router.push('/daily'))}
          />

          <Text style={styles.footnote}>
            One stop a day. Miss a day and the trail starts again — your coins stay.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles((theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.paper },
    safe: { flex: 1 },
    balance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    balanceText: {
      ...typography.heading,
      fontSize: 17,
      color: theme.colors.ink,
      paddingHorizontal: 2,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      gap: spacing.md,
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
    },
    mapCard: { padding: spacing.md, gap: spacing.md },
    mapHead: { gap: 2 },
    mapTitle: { ...typography.heading, fontSize: 18, color: theme.colors.ink },
    mapMeta: { ...typography.caption, color: theme.colors.inkMuted },
    map: { width: '100%' },
    node: {
      position: 'absolute',
      width: NODE,
      height: NODE,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      // The trail runs underneath, so every stop needs to sit on something.
      borderWidth: 3,
      borderColor: theme.colors.surface,
      // A node's puzzle artwork fills its face, so it must clip to the circle
      // rather than poking square corners out of it.
      overflow: 'hidden',
    },
    // Puzzle artwork fills the reached/current face and the locked face alike;
    // locked just dims it so the eye reads the ring and lock rather than colour.
    nodeImage: { width: '100%', height: '100%' },
    nodeImageLocked: { opacity: 0.35 },
    // A small translucent disc over the picture, so a locked stop reads locked
    // even though its (dimmed) artwork still shows what it will be.
    lockBadge: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(58, 43, 26, 0.35)',
    },
    /**
     * An unreached stop is filled with the page ground, not the card ground.
     * It used to take `surface` — a cream fill, inside a cream card, ringed in
     * cream — so on device the stops simply were not there, and the six reward
     * numbers read as digits scattered over the trail. The grey ring is what
     * makes it a locked stop rather than an unlabelled one.
     */
    nodeLocked: { borderColor: theme.colors.locked },
    nodeCurrent: {
      borderColor: theme.colors.honey,
      // Scaled rather than shadowed: a shadow on a themed ground reads as smudge.
      transform: [{ scale: 1.12 }],
    },
    footnote: { ...typography.caption, color: theme.colors.inkMuted, textAlign: 'center' },
  }),
);
