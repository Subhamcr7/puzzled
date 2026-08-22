# Home layout fixes — design

Date: 2026-08-22 · Branch `main` (working tree)

Six items reported against the Home screen: four labels rendering with letters
missing, a press state that reads as nothing happening, and a Play button that
should be lime with a radial gradient.

The four label reports look like one bug. They are **two**, with different root
causes, which is why the previous attempt at this — `da18ae2`, "stop the
quick-link labels losing letters" — fixed half of it and made the other half
worse in a way that looked deliberate.

---

## 1. Reported items

| # | Report | Where it actually lives |
| --- | --- | --- |
| 1 | "Play" renders as "Pla" | `PopButton` label |
| 2 | "Daily Puzzle" renders as "Daily Puz…" | Home `QuickLink` |
| 3 | "My Album" renders as "My Alb…" | Home `QuickLink` |
| 4 | "Library" renders as "Librar" | `PopTabBar` label — **not** the Home screen |
| 5 | Press/tap colour should be darker | Nothing darkened on press anywhere |
| 6 | Play button should be lime with a radial gradient | `PopButton` `grass` tone |

Item 4 is worth flagging: `Library` is a tab label, so the fix lands in
`PopTabBar` and changes all four tabs, not just what is visible from Home.

---

## 2. Bug A — the trailing glyph is clipped (items 1, 4)

Both affected words lose **exactly a `y`**, and that is the whole diagnosis.

Android measures a text node by its glyphs' *advance widths*, then clips drawing
to that box. A glyph whose ink extends past its own advance — the descending tail
on `y`, in both Fredoka (`Play`, 22pt) and Nunito Bold (`Library`, 11pt) — falls
outside the paint area and is dropped. The letter does not shift or squeeze; it
vanishes.

This is **not** a width problem, which is what makes it easy to misdiagnose:

- The Play button is full-width with roughly 200pt of free space around "Play".
- The widest tab label needs ~42pt inside an 82pt item.

Neither is close to overflowing. Widening either container fixes nothing, because
the clip happens at the text node's own boundary, not the container's.

**Fix.** Give the label symmetric `paddingHorizontal` — 3pt on `PopButton`, 2pt
on `PopTabBar` — as ink room for the overhang. Symmetric, so the label stays
optically centred rather than visibly nudged off-axis.

`PopTabBar` additionally drops `letterSpacing: 0.3`. Android appends tracking
*after* the final glyph and then clips to the measured box, so letter-spacing
compounds exactly this failure on the label most likely to hit it.

## 3. Bug B — the label is genuinely too narrow (items 2, 3)

Different failure. The `…` here is *deliberate*: `da18ae2` added `flexShrink: 1`
plus `numberOfLines={1}` on purpose, trading a hard clip for an ellipsis on the
reasoning that an ellipsis is "legible and obviously deliberate".

That trade was wrong. A truncated word tells the reader nothing they did not
already know, and "Daily Puz…" is not a label. The ellipsis was the symptom
management, not the fix.

The arithmetic, on a 360pt-wide device:

```
360  screen
-48  body paddingHorizontal (spacing.lg x2)
-16  quickRow gap (spacing.md)
---
296  / 2 tiles = 148pt per tile
-30  Art icon
-8   row gap (spacing.sm)
---
110pt for the label; "Daily Puzzle" needs ~90pt at 14pt
```

So it fits at rest — and that is why the old commit read it as intermittent and
blamed font loading. The real trigger is the **system font scale**: `Text` scales
with it, the 30pt icon does not. Above roughly 1.2x, the label's requirement
passes 110pt, `flexShrink` narrows it, and it ellipsises. `quickLinkInner` also
had no horizontal padding at all, so the row was already spanning the tile edge
to edge.

**Fix.** Stack the icon above the label instead of beside it. The label gets the
tile's full width (~128pt usable after 8pt padding either side), which holds to
roughly 1.4x font scale, and `numberOfLines` comes off entirely — unbounded, an
extreme scale wraps to a second line, which still shows every letter.

| Approach | Why not |
| --- | --- |
| Widen the tiles | Only two fit across; the row is already full-bleed |
| Shrink icon + gap + font, keep the row | Buys ~10pt. Fails again one notch further up the font scale |
| Cap `maxFontSizeMultiplier` | Overrides an accessibility setting to protect a layout |
| Shorten to "Daily" / "Album" | The report was explicitly that the full words must show |
| Keep the ellipsis | What was rejected |

Stacking also matches `PopTabBar`, which already puts its icon above its label,
so Home stops being the one place that does it differently.

---

## 4. Press state (item 5)

Presses were conveyed by geometry alone: `PopButton` scaled 4% and sank 2pt, and
nothing else in the app reacted at all — the quick links had **no** press
feedback of any kind. On a saturated fill a 4% squash reads as the button
wobbling rather than being pressed.

A new `PressDarken` primitive plus a `usePressProgress` hook, both in
`src/shared/ui/PressDarken.tsx`, so one press feel is shared rather than
reimplemented per surface. Applied to `PopButton` and Home's quick links.

Two decisions worth recording:

- **An overlay, not an animated `backgroundColor`.** The faces it covers are not
  all flat colours: Home's Play button is now a gradient, and
  `experimental_backgroundImage` is not a Reanimated-animatable prop. Darkening
  from on top behaves identically over a gradient, an image or a solid fill.
- **The tint is `ink`, not black.** Same reasoning the shadow tokens already
  carry: warm brown tints the cream surfaces instead of greying them. `0.26`
  opacity at full press.

`PopTabBar`'s focus pill is also darkened, from `rgba(123, 193, 22, 0.18)` to
`rgba(79, 125, 14, 0.30)`. At 0.18 over a cream bar it was barely separable, so
the focused tab did not look focused.

---

## 5. Lime Play button (item 6)

RN 0.86 — which SDK 57 ships — supports real radial gradients through
`experimental_backgroundImage`, confirmed in the installed
`StyleSheetTypes.d.ts:520` and `processBackgroundImage.js`. No new dependency,
and no need for Skia or `react-native-svg` for a button face.

```
radial-gradient(ellipse at 50% 20%, limeLight 0%, lime 50%, limeDeep 100%)
```

An ellipse rather than a circle, because a circle sized to the farthest corner of
a wide pill pushes its stops off the ends. The highlight sits above centre: dead
centre reads as a flat lighter band, offset reads as light falling on a dome.

### The label had to stop being white, and that is not a preference

This is the one consequence of item 6 that was not asked for, so it is recorded
in full.

Green dominates relative luminance, so a green bright enough to read as *lime*
cannot carry white text at WCAG AA large-text (3.0:1). Measured against white:

| Candidate | Contrast vs white | |
| --- | --- | --- |
| `grassDeep` `#659E12` (the current Play fill) | 3.25 | passes, barely |
| `#6E9B0F` | 3.30 | passes — but darker and barely limer than current |
| `#6AA513` | 3.00 | fails |
| `#6FAF14` | 2.69 | fails |
| `lime` `#8CCF1B` | 1.90 | fails |

The ceiling for a white label lands essentially *at* the colour already in use.
So "brighter lime" and "white label" are mutually exclusive here — the visible
change would have been almost nil.

Switching the label to `ink` resolves it with room to spare, and lets the lime be
genuinely bright:

| Stop | Colour | Contrast vs `ink` |
| --- | --- | --- |
| `limeLight` | `#A6E22E` | 8.79 |
| `lime` | `#8CCF1B` | 7.18 |
| `limeDeep` | `#5E9310` | 3.67 |

Every stop clears AA large text, including the darkest rim, which is the hard
case for a dark label.

| Alternative | Why not |
| --- | --- |
| Keep white, darken the lime to pass | Delivers no perceptible change from today |
| Keep white, relax the contrast assertion | 1.90:1 is unreadable in sunlight, and the guard exists on purpose |
| Bright lime centre, deeper centre behind the text | The label is centred; there is nowhere for it to sit off the highlight |

### A new `lime` tone, not a repainted `grass`

`tone="grass"` is on nine buttons across Daily, Difficulty, Results, Pack,
Puzzles and Game. The report was scoped to Home, so `grass` is untouched and
`lime` is added alongside it. Rolling lime out to every CTA is a separate,
deliberate call — it would change six other screens.

### Keeping the contrast table honest

`TONE_FILL` holds one colour per tone, which a gradient tone cannot be described
by. So:

- `TONE_GRADIENT` exports the stops **as data**, not as a finished CSS string,
  and the render builds the string from it. A hand-written string would let the
  drawn gradient and the tested one drift apart silently.
- The contrast test walks every stop, not just the fill.
- A test asserts `TONE_FILL[tone]` equals the gradient's mid stop, so the flat
  fallback is always a colour the contrast table actually measured.

---

## 6. Files changed

| File | Change |
| --- | --- |
| `src/shared/tokens.ts` | `lime` / `limeLight` / `limeDeep`; `pressState` |
| `src/shared/theme.ts` | Re-export `pressState` |
| `src/shared/ui/PressDarken.tsx` | **New** — `usePressProgress`, `PressDarken` |
| `src/shared/ui/PopButton.tsx` | `lime` tone, `TONE_GRADIENT`, label ink room, press tint |
| `src/shared/ui/PopTabBar.tsx` | Label ink room, `letterSpacing` removed, darker focus pill |
| `src/features/home/home-screen.tsx` | Stacked quick links, press feedback, `tone="lime"` |
| `src/shared/ui/index.ts` | Export the press primitives |
| `src/shared/ui/PopButton.test.tsx` | Gradient-stop contrast, fallback, ink-room guards |

---

## 7. Verification

| Check | Status |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run format:check:src` | clean |
| `npm test` | 195 passed, 26 suites |
| `npm run verify:build` | deferred to CI (`.github/workflows/android-apk.yml`) |
| Device pass | pending — see Open risk |

Lint caught one real defect on the first pass. `usePressProgress` originally
memoised its handlers, which meant passing `progress` into `useMemo` and then
writing to it inside — `react-hooks/immutability` rejects that, and it is right
to: a shared value's identity is exactly what a dependency array claims to track.
The handlers are now rebuilt per render, which is what the inline arrow props on
`Pressable` did before this hook existed.

The APK is built on GitHub's runners, not locally — `android/` is gitignored and
generated by `expo prebuild --clean` on the runner. Note that the workflow's
`paths-ignore` covers `docs/**`, so this document does not trigger a build on its
own; the source changes do.

## 8. Open risk

**Bug A's fix is unconfirmed on hardware.** The `y`-shaped evidence is strong —
two independent reports, two different fonts, both losing exactly the
right-overhanging glyph — and padding is the standard remedy for it. But glyph
clipping is a device rendering behaviour that neither the type checker, the
linter nor the test suite can observe. The added test asserts only that the ink
room *exists*, not that it is sufficient.

So this needs eyes on a real device at the default font scale and at a raised
one. If the tail still clips, the padding is too small rather than the diagnosis
being wrong, and the next step is raising it — not restructuring the layout.

This is the same class of failure the repo already got burned by once: the
offscreen-surface piece caching in `README.md`'s Known gaps, which typechecked,
linted, passed tests, and rendered every piece blank on device.
