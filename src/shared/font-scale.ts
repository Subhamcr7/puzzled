import { Dimensions } from 'react-native';

/**
 * The system font scale, captured exactly once when this module is imported.
 *
 * Labels scale themselves by this constant and set `allowFontScaling={false}`,
 * rather than letting Android scale them. Handing Android the job is not what
 * clipped trailing letters off "Play" and "Library" — that was the font-loading
 * race described in `fonts.test.ts` — so this is not a workaround for it.
 *
 * It stays manual because a constant makes every dependent metric agree: the tab
 * bar derives its own height from the same number as its label's line box
 * (`PopTabBar`), so the bar grows with the labels instead of being overflowed by
 * them. A hook-driven scale would change those two at different times.
 *
 * The cost is that a user who changes their system font size mid-session keeps
 * the scale the app started with until the next launch.
 */
export const FONT_SCALE = Math.max(1, Dimensions.get('window').fontScale || 1);
