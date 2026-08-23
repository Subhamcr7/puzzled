// Node globals are referenced here rather than added to tsconfig's `types`, so
// `fs`/`__dirname` stay out of scope for the app code, which has no filesystem.
/// <reference types="node" />
import { existsSync } from 'node:fs';
import path from 'node:path';

import appJson from '../../app.json';

import { fonts } from './theme';

/**
 * Keeps every custom family **embedded at build time**, which is what stops
 * labels from losing their trailing letters.
 *
 * The bug: "Play" drew as "Pla", "Library" as "Librar", but only in a release APK
 * and only when the device font size was above 1.0x. Six style-level fixes
 * (padding, line heights, clip flags, manual scaling) all failed because none of
 * them touched the cause. Screenshots of the same commit told it plainly — the
 * dev-client run painted the *fallback* face and rendered whole words, the
 * release APK painted Fredoka and lost letters. So the layout was measured
 * against one typeface and painted with another: `useFonts` registers a family
 * *after* JS starts, and Fabric does not re-measure text already laid out with
 * the fallback. Fredoka is wider than the fallback, so the extra width fell
 * outside a box that was never remeasured — invisible at 1.0x, where the label's
 * own horizontal padding absorbed it, and obvious above it.
 *
 * The fix is to have no such window at all: the `expo-font` config plugin copies
 * these files into `android/app/src/main/assets/fonts` during prebuild, and
 * Android resolves `fontFamily: "X"` from `assets/fonts/X.ttf` synchronously on
 * first use — the correct face is present before the first measure. That is also
 * why the filenames must match the family names exactly, which is what these
 * tests pin. See `docs/superpowers/specs/2026-08-22-home-layout-fixes-design.md`
 * §12.
 */

/**
 * `app.json` imports with its literal shape, which types every plugin entry as
 * its own tuple and makes a lookup by name unassignable. Widening once here keeps
 * the assertions below readable.
 */
type PluginEntry = string | [string, Record<string, unknown>];

const PROJECT_ROOT = path.join(__dirname, '../..');

function embeddedFontPaths(): string[] {
  const plugins = appJson.expo.plugins as unknown as PluginEntry[];
  const entry = plugins.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-font',
  );
  if (!entry) {
    throw new Error(
      'expo-font is not configured in app.json — fonts loaded only at runtime clip their last glyphs',
    );
  }
  const declared = entry[1].fonts;
  if (!Array.isArray(declared)) {
    throw new Error('the expo-font plugin declares no `fonts` array');
  }
  return declared.map(String);
}

describe('custom fonts', () => {
  const embedded = embeddedFontPaths();

  it.each(Object.values(fonts))('embeds %s at build time', (family) => {
    // Android reads `assets/fonts/<fontFamily>.ttf`, so the basename *is* the
    // family name — a renamed file silently falls back to the system face.
    expect(embedded.map((file) => path.basename(file))).toContain(`${family}.ttf`);
  });

  it.each(embedded)('ships %s in the repo', (file) => {
    expect(existsSync(path.join(PROJECT_ROOT, file))).toBe(true);
  });

  it('embeds nothing the theme does not use', () => {
    const families = new Set<string>(Object.values(fonts));
    const extra = embedded
      .map((file) => path.basename(file, '.ttf'))
      .filter((family) => !families.has(family));
    expect(extra).toEqual([]);
  });
});
