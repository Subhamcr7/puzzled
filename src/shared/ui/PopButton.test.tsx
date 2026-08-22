import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PopButton, TONE_FILL, TONE_GRADIENT, TONE_LABEL, type PopTone } from './PopButton';

/** Relative luminance per WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TONES = Object.keys(TONE_FILL) as PopTone[];

describe('PopButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<PopButton label="Play" onPress={onPress} />);
    fireEvent.press(getByText('Play'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<PopButton label="Play" onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes the label as the default accessibility label', () => {
    const { getByLabelText } = render(<PopButton label="Play" />);
    expect(getByLabelText('Play')).toBeTruthy();
  });

  it('prefers an explicit accessibility label over the visible one', () => {
    const { getByLabelText } = render(
      <PopButton label="3" accessibilityLabel="Three hints remaining" />,
    );
    expect(getByLabelText('Three hints remaining')).toBeTruthy();
  });

  it('marks itself disabled for assistive technology', () => {
    const { getByRole } = render(<PopButton label="Play" disabled />);
    expect(getByRole('button')).toBeDisabled();
  });

  // This palette is bright enough that white text fails on nearly all of it —
  // the mockup's own white-on-green is 2.21:1. Tones wanting white therefore use
  // a deepened fill. Buttons render at 18pt+, so the bar is WCAG AA large text.
  it.each(TONES)('pairs a readable label with the %s fill', (tone) => {
    expect(contrast(TONE_LABEL[tone], TONE_FILL[tone])).toBeGreaterThanOrEqual(3);
  });

  it('actually renders the tone table it advertises', () => {
    const { getByText } = render(<PopButton label="Play" tone="grass" />);
    const label = StyleSheet.flatten(getByText('Play').props.style);
    expect(label.color).toBe(TONE_LABEL.grass);
  });

  // A gradient tone's label sits over every stop, so checking the flat fill alone
  // proves nothing about the ends. The lightest stop is the hard case for a light
  // label and the darkest for a dark one, so both have to clear the bar. This is
  // what makes Home's lime Play button take ink: white over that lime measures
  // about 2:1, and no gradient hides a label you cannot read.
  const GRADIENT_TONES = Object.keys(TONE_GRADIENT) as PopTone[];

  it.each(GRADIENT_TONES)('keeps the %s label readable over every gradient stop', (tone) => {
    const stops = TONE_GRADIENT[tone];
    expect(stops).toBeDefined();
    for (const stop of stops ?? []) {
      expect(contrast(TONE_LABEL[tone], stop)).toBeGreaterThanOrEqual(3);
    }
  });

  // The flat fill is what a gradient tone falls back to, so it has to be the
  // gradient's own mid stop. Letting them drift means the fallback renders a colour
  // the contrast table above never measured.
  it.each(GRADIENT_TONES)('falls back to the %s gradient mid stop', (tone) => {
    expect(TONE_FILL[tone]).toBe(TONE_GRADIENT[tone]?.[1]);
  });

  it('gives the label ink room so the trailing glyph is not clipped', () => {
    // Android clips a text node to its glyphs' advance widths, dropping ink that
    // overhangs — the tail on Fredoka's `y`, which rendered "Play" as "Pla".
    const { getByText } = render(<PopButton label="Play" />);
    const label = StyleSheet.flatten(getByText('Play').props.style);
    expect(label.paddingHorizontal).toBeGreaterThan(0);
  });
});
