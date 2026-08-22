import { Dimensions } from 'react-native';

/**
 * The system font scale, captured exactly once when this module is imported.
 *
 * Every label in the app multiplies its sizes by this constant and sets
 * `allowFontScaling={false}`. The point is that label props must never change
 * after mount: RN 0.86's Fabric re-measures text when its attributes update and
 * lays the view out with one font size while painting another, which sheared
 * whole trailing letters off every button and tab label ("Play" → "Pla") on any
 * device whose font setting is above 1.0x. Reproduced on-device over adb; see
 * `docs/superpowers/specs/2026-08-22-home-layout-fixes-design.md` §12.
 *
 * A user who changes their system font size mid-session keeps the scale the app
 * started with until the next launch — a fair trade for words that always draw
 * completely.
 */
export const FONT_SCALE = Math.max(1, Dimensions.get('window').fontScale || 1);
