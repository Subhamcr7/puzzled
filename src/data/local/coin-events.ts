/**
 * App-wide "coins were credited" event, living in the data layer purely so the
 * wallet repository can announce a reward without importing any UI module —
 * `expo-audio` cannot be required under Jest, and the wallet is tested there.
 *
 * The UI subscribes once at launch (`board-audio.ts`) and plays the coin sound
 * on every successful `deltaCoins > 0` ledger insert. Subscribe/unsubscribe is
 * the whole API; nothing here imports native modules.
 */
type AmountListener = (amount: number) => void;

const listeners = new Set<AmountListener>();

/** Register a listener. Returns an unsubscribe function (usable in one call). */
export function onCoinGained(listener: AmountListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Announce a coin credit. Catched per listener so one failure can't stop the rest. */
export function emitCoinGained(amount: number): void {
  for (const listener of [...listeners]) {
    try {
      listener(amount);
    } catch {
      // Best-effort: an audio failure must never break wallet writes.
    }
  }
}
