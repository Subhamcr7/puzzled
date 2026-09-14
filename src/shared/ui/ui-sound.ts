/**
 * Global UI tap sound — the bridge between pressables and the audio player.
 *
 * This module is deliberately dependency-free (no React Native, no expo-audio).
 * Shared primitives and feature screens call `playUiTap()` on any button press,
 * and the real player is registered once at app start by the audio manager
 * (`board-audio.ts`). Until it registers, taps are silent no-ops — which also
 * keeps every Jest render that presses a button free of native audio.
 *
 * Fire-and-forget by design: a tap sound must never block the action it rides.
 */
let tapHandler: (() => void) | null = null;

/** Attach the real player. Passing `null` silences taps (used in tests). */
export function setUiTapHandler(handler: (() => void) | null): void {
  tapHandler = handler;
}

/** Play the button-tap sound, if one is wired up. Never throws. */
export function playUiTap(): void {
  try {
    tapHandler?.();
  } catch {
    // A failed tap sound must never interrupt the press.
  }
}
