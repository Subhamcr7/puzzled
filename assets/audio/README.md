# Board audio — generated placeholders + supplied effects

Three of the effect clips are **real audio supplied by the product owner**
(`H:\projects\puzzled\sound\`), copied in under kebab-case names:

| File | Supplied as | Used for |
| --- | --- | --- |
| `button-tap.mp3` | `button tap.mp3` | Global UI tap — every button/pressable |
| `puzzle-place.mp3` | `puzzle pieces sound.mp3` | A piece clicking into place on the board |
| `coin-gain.mp3` | `coin add sound .mp3` | Coins being credited to the wallet |

The `.wav` files in this folder are **synthesized placeholders** for the board.
They exist so the board (`src/features/game/puzzle-board.tsx`) has something to
play while final assets are pending — replace them wholesale once real assets
exist (regenerate with `node scripts/generate-placeholder-audio.mjs`; the script
is dependency-free and writes 16-bit mono 44.1kHz PCM with a hand-rolled RIFF
header, so every placeholder is reproducible from source).

| File | Character |
| --- | --- |
| `pickup.wav` | 90ms, 660Hz sine, fast exponential decay — piece lifted |
| `snap.wav` | 140ms, 440→880Hz rising sine + short noise transient — piece locks |
| `complete.wav` | ~700ms, arpeggio across 523/659/784/1047Hz — puzzle finished |
| `ambient.wav` | 4s seamless loop, two detuned sines (220Hz / 220.5Hz) with a slow amplitude swell |

All clips have a 5ms linear fade in/out so playback never clicks.
