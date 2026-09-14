import { dateKey, pickDailyPuzzle, streakFrom, type PuzzleCompletion } from '@/data';

/**
 * The daily treasure hunt.
 *
 * A seven-stop map you advance along by finishing the day's challenge, looping
 * every week. Deliberately *not* a dig-for-a-hidden-chest minigame: pure luck
 * has no skill to get better at and stops being interesting in three days, and
 * it would need a mechanic of its own to balance. This reuses the daily puzzle
 * as its input, so there is nothing new to tune — and it exists to give a reason
 * to come back tomorrow, which a streak does and a lottery does not.
 *
 * Nothing here is stored. Position is *derived* from the completions log, which
 * means it cannot drift out of sync with what the player actually did, and a
 * reinstall that restores progress restores the hunt with it.
 */

/** Stops on the map. A week, so the loop matches how people think about days. */
export const TREASURE_STOPS = 7;

/** How far back to look when rebuilding the streak. Well past any real streak. */
export const TREASURE_LOOKBACK_DAYS = 90;

/**
 * Coins for landing on a stop.
 *
 * Rising, so the week builds, with the last stop paying several times the
 * others — that step up is the whole reason to come back on day seven rather
 * than drifting off on day four. Still under a big board's payout, so playing
 * remains the better earner (`wallet-repository.test.ts` pins that).
 */
export function treasureRewardForStop(stop: number): number {
  if (stop < 1 || stop > TREASURE_STOPS) {
    return 0;
  }
  return stop === TREASURE_STOPS ? 200 : 20 + (stop - 1) * 10;
}

/**
 * Campaign difficulty shown on the map for a stop.
 *
 * Display copy only — the actual challenge lets the player pick any grid size
 * (Easy to Hard) on the difficulty screen, so the tier never constrains play.
 * It climbs along the path so the week reads as building: 1–2 Easy, 3–5
 * Medium, 6–7 Hard. Lives here so the screen and its tests agree by
 * construction, the same way the rewards do.
 */
export function treasureTierForStop(stop: number): 'Easy' | 'Medium' | 'Hard' {
  if (stop >= 1 && stop <= 2) return 'Easy';
  if (stop >= 3 && stop <= 5) return 'Medium';
  return 'Hard';
}

export interface TreasureProgress {
  /** Consecutive days the daily challenge has been finished, ending today. */
  streak: number;
  /** Which stop the player stands on, 0 when the streak has not started. */
  stop: number;
  /** Whether today's challenge is already done. */
  doneToday: boolean;
  /** Day keys the daily was completed on, newest first — for the calendar. */
  completedDays: string[];
}

/**
 * Where the player stands, from the completions log alone.
 *
 * `pickDailyPuzzle` is deterministic from a date key, so which puzzle *was* a
 * given day's challenge can be recomputed rather than remembered — and a
 * completion of that puzzle on that day is what counts. That is why this needs
 * no table of its own, and why it agrees with the Daily screen by construction
 * rather than by both being updated together.
 */
export function treasureProgress(
  pool: readonly { id: string }[],
  completions: readonly PuzzleCompletion[],
  todayKey: string,
  lookbackDays: number = TREASURE_LOOKBACK_DAYS,
): TreasureProgress {
  // Completions bucketed by the day they happened, so the walk below is a set
  // lookup per day rather than a scan of the whole log.
  const byDay = new Map<string, Set<string>>();
  for (const entry of completions) {
    const day = dateKey(new Date(entry.completedAt));
    const ids = byDay.get(day) ?? new Set<string>();
    ids.add(entry.puzzleId);
    byDay.set(day, ids);
  }

  const completedDays: string[] = [];
  const cursor = new Date(`${todayKey}T00:00:00`);
  for (let i = 0; i < lookbackDays; i += 1) {
    const day = dateKey(cursor);
    const pick = pickDailyPuzzle(pool, day);
    if (pick && byDay.get(day)?.has(pick.id)) {
      completedDays.push(day);
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  const streak = streakFrom(completedDays, todayKey);
  return {
    streak,
    // The map loops: day 8 is stop 1 of the next lap, not an eighth stop.
    stop: streak === 0 ? 0 : ((streak - 1) % TREASURE_STOPS) + 1,
    doneToday: completedDays.includes(todayKey),
    completedDays,
  };
}

function addDays(key: string, days: number): string {
  const cursor = new Date(`${key}T00:00:00`);
  cursor.setDate(cursor.getDate() + days);
  return dateKey(cursor);
}

/**
 * The day a stop's challenge belongs to, so a node can show that day's puzzle
 * image.
 *
 * A reached stop (and the stop the player stands on) maps to the actual played
 * day from the completions log — the newest entries of `completedDays` are the
 * current run, and stop `n` sits `s - n` places back from the current stop `s`.
 * A stop still ahead maps to the day it will land if the trail keeps moving:
 * tomorrow when today already counts, today when today's challenge is still
 * open, and `n - 1` days ahead when the trail has not started. Both are
 * deterministic, so the map never flickers between visits.
 */
export function treasureStopDayKey(
  progress: TreasureProgress,
  todayKey: string,
  stop: number,
): string | null {
  if (stop < 1 || stop > TREASURE_STOPS) {
    return null;
  }
  if (progress.streak <= 0) {
    return addDays(todayKey, stop - 1);
  }
  const s = ((progress.streak - 1) % TREASURE_STOPS) + 1;
  if (stop <= s) {
    const day = progress.completedDays[s - stop];
    if (day != null) {
      return day;
    }
  }
  const lastPlayed = addDays(todayKey, progress.doneToday ? 0 : -1);
  return addDays(lastPlayed, stop - s);
}

/**
 * The puzzle whose image a stop shows.
 *
 * `pickDailyPuzzle` is deterministic from a day key, and a stop's day comes
 * from `treasureStopDayKey`, so the image is stable across visits and laps
 * without remembering anything. For reached stops it is the puzzle that was
 * actually played that day; for the trail ahead it is the (deterministic)
 * challenge the day would hold.
 */
export function treasurePuzzleForStop<T extends { id: string }>(
  pool: readonly T[],
  completions: readonly PuzzleCompletion[],
  todayKey: string,
  stop: number,
): T | null {
  const progress = treasureProgress(pool, completions, todayKey);
  const day = treasureStopDayKey(progress, todayKey, stop);
  return day ? pickDailyPuzzle(pool, day) : null;
}
