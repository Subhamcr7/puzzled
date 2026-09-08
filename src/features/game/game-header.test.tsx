import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { radii, spacing } from '@/shared/theme';

import { GameHeader, HEADER_SCALE, INFO_BOX_MIN_W } from './game-header';

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
  const onHint = jest.fn();
  const onEdges = jest.fn();
  const onPreview = jest.fn();
  const onPause = jest.fn();
  const rendered = render(
    <GameHeader
      locked={locked}
      total={total}
      elapsedMs={elapsedMs}
      highlightEdges={false}
      onBack={onBack}
      onHint={onHint}
      onEdges={onEdges}
      onPreview={onPreview}
      onPause={onPause}
    />,
  );
  return { rendered, onBack, onHint, onEdges, onPreview, onPause };
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

  it('groups Hint, Edges, Preview and Pause on a second row, right-aligned under the boxes', () => {
    const { rendered } = renderHeader();
    const tools = rendered.getByTestId('game-header-tools');

    expect(StyleSheet.flatten(tools.props.style)).toMatchObject({
      flexDirection: 'row',
      justifyContent: 'flex-end',
    });

    for (const label of ['Hint', 'Edges', 'Preview', 'Pause']) {
      expect(within(tools).getByLabelText(label)).toBeTruthy();
    }
    // Back lives only on the top row.
    expect(within(tools).queryByLabelText('Back')).toBeNull();
  });

  it('sits inside one shared rounded tray, right-aligned under the boxes', () => {
    const { rendered } = renderHeader();
    const tray = StyleSheet.flatten(rendered.getByTestId('tool-tray').props.style);

    // One rounded cream surface with a card shadow, hugging the right edge so
    // the group lands directly below the count/timer pair, not the Back button.
    expect(tray).toMatchObject({
      borderRadius: radii.lg,
      alignSelf: 'flex-end',
    });
    expect(tray.backgroundColor).toBeTruthy();
    expect(tray.boxShadow).toBeTruthy();

    // The four tools live inside the tray, on the shared row.
    const tools = rendered.getByTestId('game-header-tools');
    expect(within(rendered.getByTestId('tool-tray')).getByTestId('game-header-tools')).toBeTruthy();
    expect(tools.props.children).toHaveLength(4);
  });

  it('wires every control to its action', () => {
    const { rendered, onBack, onHint, onEdges, onPreview, onPause } = renderHeader();
    fireEvent.press(rendered.getByLabelText('Back'));
    fireEvent.press(rendered.getByLabelText('Hint'));
    fireEvent.press(rendered.getByLabelText('Edges'));
    fireEvent.press(rendered.getByLabelText('Preview'));
    fireEvent.press(rendered.getByLabelText('Pause'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onHint).toHaveBeenCalledTimes(1);
    expect(onEdges).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('has no transform, rotation or skew anywhere in the header', () => {
    const { rendered } = renderHeader();
    const keys = collectStyleKeys(rendered);
    for (const key of forbiddenTransformKeys) {
      expect(keys.has(key)).toBe(false);
    }
  });
});

describe('GameHeader second-row group', () => {
  it('keeps all four tools on one row, in order Hint, Edges, Preview, Pause', () => {
    const { rendered } = renderHeader();
    const tools = rendered.getByTestId('game-header-tools');

    // The four buttons are direct children of the single tools container.
    expect(tools.props.children).toHaveLength(4);

    const labels = within(tools)
      .getAllByRole('button')
      .map((button) => ({
        label: button.props.accessibilityLabel,
        style: StyleSheet.flatten(button.props.style),
      }));
    expect(labels.map(({ label }) => label)).toEqual(['Hint', 'Edges', 'Preview', 'Pause']);
  });

  it('never wraps: a single horizontal row with one shared gap and no per-button margins', () => {
    const { rendered } = renderHeader();
    const tools = rendered.getByTestId('game-header-tools');
    const row = StyleSheet.flatten(tools.props.style);

    expect(row).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'center',
    });
    // Exactly the same spacing token for every gap in the group.
    expect(row.gap).toBe(spacing.xs);

    // No button adds margins of its own, so the parent gap is the one and only
    // spacing source — the three gaps are identical by construction.
    for (const label of ['Hint', 'Edges', 'Preview', 'Pause']) {
      const style = StyleSheet.flatten(within(tools).getByLabelText(label).props.style) as Record<
        string,
        unknown
      >;
      for (const key of Object.keys(style)) {
        expect(key.startsWith('margin')).toBe(false);
      }
    }
  });

  it('right-aligns the group under the count/timer boxes, away from the Back button', () => {
    const { rendered } = renderHeader();
    const tools = rendered.getByTestId('game-header-tools');
    expect(StyleSheet.flatten(tools.props.style).justifyContent).toBe('flex-end');
    expect(within(tools).queryByLabelText('Back')).toBeNull();
  });

  it('keeps every control at the 1.2× size', () => {
    const { rendered } = renderHeader();
    const lockable = StyleSheet.flatten(rendered.getByText('0/784').props.style);
    const clock = StyleSheet.flatten(rendered.getByText('00:21').props.style);
    expect(lockable.fontSize).toBe(16 * HEADER_SCALE);
    expect(clock.fontSize).toBe(16 * HEADER_SCALE);

    const tools = rendered.getByTestId('game-header-tools');
    for (const label of ['Back', 'Hint', 'Edges', 'Preview', 'Pause']) {
      const button = StyleSheet.flatten(
        (label === 'Back' ? rendered : within(tools)).getByLabelText(label).props.style,
      );
      expect(button.width).toBe(32 * HEADER_SCALE);
      expect(button.height).toBe(32 * HEADER_SCALE);
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
