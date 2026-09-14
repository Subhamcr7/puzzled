import { emitCoinGained } from '@/data';

import { configureAudioSettings, initBoardAudio, setSfxEnabled } from './board-audio';
import { setUiTapHandler, playUiTap } from '@/shared/ui/ui-sound';

/**
 * `expo-audio`'s native module cannot be required under Jest (its JS throws at
 * import time), so it is stubbed here at the player level. That keeps the real
 * `board-audio` logic — the Sound gate, the app-wide tap wiring and the
 * coin-gain subscription — under test end to end, with `createAudioPlayer`
 * handing back recordable stand-ins.
 */
const mockPlayers: { play: jest.Mock; pause: jest.Mock; seekTo: jest.Mock }[] = [];

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const player = {
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      playing: false,
      loop: false,
      volume: 1,
    };
    mockPlayers.push(player);
    return player;
  }),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

// `SFX_SOURCES` enumerates its keys in declaration order, so after
// `ensurePlayersLoaded` the created players are pickup, snap, complete,
// buttonTap, place, coinGain, then the single ambient player.
const BUTTON_TAP = 3;
const COIN_GAIN = 5;
const AMBIENT = 6;

const SETTINGS_ON = {
  sound: true,
  music: false,
  haptics: true,
  showGrid: false,
  snapAssist: true,
  themeId: 'meadow',
};
const SETTINGS_MUSIC = {
  sound: true,
  music: true,
  haptics: true,
  showGrid: false,
  snapAssist: true,
  themeId: 'meadow',
};

beforeEach(() => {
  // Players are module-level singletons once `ensurePlayersLoaded` has run, so
  // `mockPlayers` keeps the same objects for the whole file — only their call
  // history is reset between tests.
  setUiTapHandler(null);
  jest.clearAllMocks();
});

describe('board-audio global UI sounds', () => {
  it('plays one tap sound per UI activation, and none while Sound is off', async () => {
    await initBoardAudio(SETTINGS_ON);
    const tapPlayer = mockPlayers[BUTTON_TAP];
    expect(tapPlayer).toBeTruthy();

    tapPlayer.play.mockClear();
    playUiTap();
    expect(tapPlayer.play).toHaveBeenCalledTimes(1);
    playUiTap();
    playUiTap();
    expect(tapPlayer.play).toHaveBeenCalledTimes(3);

    setSfxEnabled(false);
    tapPlayer.play.mockClear();
    playUiTap();
    expect(tapPlayer.play).not.toHaveBeenCalled();
  });

  it('plays the coin-gain sound once per positive credit, and not on 0', async () => {
    await initBoardAudio(SETTINGS_ON);
    const coinPlayer = mockPlayers[COIN_GAIN];

    coinPlayer.play.mockClear();
    emitCoinGained(30);
    expect(coinPlayer.play).toHaveBeenCalledTimes(1);
    expect(coinPlayer.play).toHaveBeenCalledWith();

    emitCoinGained(50);
    expect(coinPlayer.play).toHaveBeenCalledTimes(2);
  });

  it('subscribes the coin listener exactly once across repeated wires', async () => {
    await initBoardAudio(SETTINGS_ON);
    await initBoardAudio(SETTINGS_ON);
    const coinPlayer = mockPlayers[COIN_GAIN];

    coinPlayer.play.mockClear();
    emitCoinGained(40);
    expect(coinPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('starts the ambient loop on the board init that turns music on', async () => {
    await initBoardAudio(SETTINGS_MUSIC);
    expect(mockPlayers[AMBIENT].play).toHaveBeenCalled();
  });

  it('configures sfx without restarting the ambient loop', async () => {
    await initBoardAudio(SETTINGS_MUSIC);
    const ambientPlayer = mockPlayers[AMBIENT];
    expect(ambientPlayer.play).toHaveBeenCalledTimes(1);

    configureAudioSettings(SETTINGS_MUSIC);
    expect(ambientPlayer.play).toHaveBeenCalledTimes(1);
  });
});
