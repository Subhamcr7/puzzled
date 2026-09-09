import { render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { radii } from '@/shared/theme';

import { GameHeader, INFO_BOX_MIN_W } from './game-header';

/** `mm:ss` or `h:mm:ss` → milliseconds, mirroring `formatClock`. */
function msFor(face: string): number {
  const parts = face.split(':').map(Number);
  const [a, b, c] = parts.length === 3 ? parts : [0, ...parts];
  return ((a * 60 + b) * 60 + c) * 1000;
}

const samples = ['00:01', '00:09', '00:10', '00:59', '01:00', '01:09', '09:59', '10:00', '59:59'];

/** Every style key below the header, flattened once. */
function collectStyleKeys(rendered: ReturnType<typeof render>): Set<string> {
  const keys = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node == null || typeof node !== 'object') return;
    const json = node as { type?: unknown; props?: Record<string, unknown>; children?: unknown[] };
    if (json.props) {
      const style = json.props.style;
      if (style != null) {
        Object.keys(StyleSheet.flatten(style)).forEach((key) => keys.add(key));
      }
    }
    if (Array.isArray(json.children)) {
      json.children.forEach(visit);
    }
  };
  visit(rendered.toJSON());
  return keys;
}

const forbiddenTransformKeys = [
  'transform',
  'rotate',
  'rotateX',
  'rotateY',
  'skewX',
  'skewY',
  'scale',
  'scaleX',
  'scaleY',
  'perspective',
  'transformMatrix',
];

function renderHeader(elapsedMs = msFor('00:21'), locked = 0, total = 784) {
  const onBack = jest.fn();
  const rendered = render(
    <GameHeader locked={locked} total={total} elapsedMs={elapsedMs} onBack={onBack} />,
  );
  return { rendered, onBack };
}

describe('GameHeader layout', () => {
  it('arranges Back alone on the left of the top row, with count then timer on the right', () => {
    const { rendered } = renderHeader();
    const top = rendered.getByTestId('game-header-top');

    // Top row is a flex row pushing its ends apart: Back left, pair right.
    expect(StyleSheet.flatten(top.props.style)).toMatchObject({
      flexDirection: 'row',
      justifyContent: 'space-between',
    });

    expect(within(top).getByLabelText('Back')).toBeTruthy();
    const count = within(top).getByTestId('count-box');
    const timer = within(top).getByTestId('timer-box');
    expect(count).toBeTruthy();
    expect(timer).toBeTruthy();
  });

  it('has no transform, rotation or skew anywhere in the header', () => {
    const { rendered } = renderHeader();
    const keys = collectStyleKeys(rendered);
    for (const key of forbiddenTransformKeys) {
      expect(keys.has(key)).toBe(false);
    }
  });
});

describe('GameHeader timer-box geometry', () => {
  it('keeps the pill styling on the shared wrapper', () => {
    const { rendered } = renderHeader();
    const wrapper = StyleSheet.flatten(rendered.getByTestId('timer-box').props.style);
    const face = StyleSheet.flatten(rendered.getByTestId('timer-box-face').props.style);
    expect(wrapper.borderRadius).toBe(radii.pill);
    // The box content is centred inside the fixed width.
    expect(face).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  it('is frozen to a fixed minimum width, independent of the rendered time', () => {
    const baseline = new Map<string, string>();
    for (const sample of samples) {
      const { rendered } = renderHeader(msFor(sample));
      const timerFace = StyleSheet.flatten(rendered.getByTestId('timer-box-face').props.style);
      expect(timerFace.minWidth).toBeGreaterThan(0);
      baseline.set(sample, JSON.stringify(timerFace));
    }

    // Every one of 00:01 … 59:59 produces the identical box geometry, so a
    // rounder digit, a narrower "1" or a minute roll-over cannot move the right
    // edge of the pill.
    const [first, ...rest] = [...baseline.values()];
    for (const other of rest) {
      expect(other).toBe(first);
    }
  });

  it('shows a still-credible count box that never re-measures as pieces are placed', () => {
    const zero = StyleSheet.flatten(
      renderHeader(0, 0, 784).rendered.getByTestId('count-box-face').props.style,
    );
    const max = StyleSheet.flatten(
      renderHeader(0, 784, 784).rendered.getByTestId('count-box-face').props.style,
    );
    expect(zero.minWidth).toBeGreaterThan(0);
    expect(JSON.stringify(max)).toBe(JSON.stringify(zero));
  });

  it('gives the count and timer one identical shared outer width', () => {
    const { rendered } = renderHeader();
    const countFace = StyleSheet.flatten(rendered.getByTestId('count-box-face').props.style);
    const timerFace = StyleSheet.flatten(rendered.getByTestId('timer-box-face').props.style);
    expect(countFace.minWidth).toBe(INFO_BOX_MIN_W);
    expect(timerFace.minWidth).toBe(INFO_BOX_MIN_W);
    expect(timerFace.minWidth).toBe(countFace.minWidth);
  });

  it('keeps the count and timer boxes centred text slots (no jitter inside the pill)', () => {
    const { rendered } = renderHeader();
    const countText = StyleSheet.flatten(rendered.getByText('0/784').props.style);
    const clockText = StyleSheet.flatten(rendered.getByText('00:21').props.style);
    expect(countText.textAlign).toBe('center');
    expect(clockText.textAlign).toBe('center');
    expect(clockText.fontVariant).toContain('tabular-nums');
  });
});
