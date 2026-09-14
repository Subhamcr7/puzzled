import { playUiTap, setUiTapHandler } from './ui-sound';

/**
 * `ui-sound` is the dependency-free bridge between pressables and the audio
 * manager. Until a handler is registered every tap must be a no-op (that is
 * what keeps every other Jest render free of native audio); once registered,
 * each activation must reach the real player exactly once.
 */

describe('ui-sound', () => {
  afterEach(() => {
    setUiTapHandler(null);
  });

  it('is a silent no-op with no handler registered', () => {
    expect(() => playUiTap()).not.toThrow();
  });

  it('plays exactly one tap per activation once a handler is registered', () => {
    const handler = jest.fn();
    setUiTapHandler(handler);
    playUiTap();
    playUiTap();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('silences taps again when the handler is cleared', () => {
    setUiTapHandler(jest.fn());
    setUiTapHandler(null);
    expect(() => playUiTap()).not.toThrow();
  });

  it('never lets a failing handler interrupt the press', () => {
    setUiTapHandler(() => {
      throw new Error('audio blew up');
    });
    expect(() => playUiTap()).not.toThrow();
  });

  it('re-points immediately when a new handler replaces the old one', () => {
    const first = jest.fn();
    const second = jest.fn();
    setUiTapHandler(first);
    setUiTapHandler(second);
    playUiTap();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
