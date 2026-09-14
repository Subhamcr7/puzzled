// Node globals are referenced here rather than added to tsconfig's `types`, so
// `fs`/`__dirname` stay out of scope for the app code, which has no filesystem.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import appJson from '../../app.json';

import { backgrounds } from './tokens';

/**
 * Keeps the launch reading as **one** screen with **one** bear.
 *
 * Android draws its splash window from the moment the icon is tapped until React
 * Native has a frame. That window cannot be removed, only dressed. On device this
 * read as *two* bears: the native window's static bear first, then the mascot in
 * `LoadingScreen` beside the wordmark. The report was explicit — drop the first,
 * keep the second.
 *
 * The icon cannot simply be dropped from the config: the plugin writes
 * `windowSplashScreenAnimatedIcon` into `styles.xml` unconditionally, so removing
 * `image` leaves the theme pointing at a missing resource and aapt2 fails the
 * build (this is how CI run 15 died). The native window therefore carries a fully
 * transparent PNG instead — the launch shows only its flat sky until
 * `LoadingScreen` mounts with the single bear, wordmark and dots.
 */

const ANDROID_SPLASH_CANVAS_DP = 288;

/**
 * The asset `MEASURED_ASSET_SHA256` pins is deliberately blank, so there is no
 * content diameter to keep inside the mask — any `imageWidth` renders nothing.
 */
const MEASURED_ASSET_SHA256 = 'c05bcde1ddc0492b5ff57db2e931c456c4d209b9508c65b192a5ca864ca5a01a';

/**
 * `app.json` imports with its literal shape, which types every plugin entry as
 * its own tuple and makes a lookup by name unassignable. Widening once here keeps
 * the assertions below readable.
 */
type PluginEntry = string | [string, Record<string, unknown>];

function splashPluginConfig(): Record<string, unknown> {
  const plugins = appJson.expo.plugins as unknown as PluginEntry[];
  const entry = plugins.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  if (!entry) {
    throw new Error('expo-splash-screen is not configured in app.json');
  }
  return entry[1];
}

describe('native splash', () => {
  const config = splashPluginConfig();

  it('declares an image, which the Android build requires', () => {
    expect(config.image).toBeDefined();
  });

  it('is still the pinned blank asset', () => {
    const assetPath = path.join(__dirname, '../..', String(config.image));
    const actual = createHash('sha256').update(readFileSync(assetPath)).digest('hex');
    expect(actual).toBe(MEASURED_ASSET_SHA256);
  });

  it('never asks for an image wider than the canvas the plugin composites onto', () => {
    expect(Number(config.imageWidth)).toBeLessThanOrEqual(ANDROID_SPLASH_CANVAS_DP);
  });

  it('shares its background with the loading screen that replaces it', () => {
    expect(String(config.backgroundColor).toUpperCase()).toBe(backgrounds.homeSky.toUpperCase());
  });
});
