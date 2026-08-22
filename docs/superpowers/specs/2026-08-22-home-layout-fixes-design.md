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

| #   | Report                                            | Where it actually lives                     |
| --- | ------------------------------------------------- | ------------------------------------------- |
| 1   | "Play" renders as "Pla"                           | `PopButton` label                           |
| 2   | "Daily Puzzle" renders as "Daily Puz…"            | Home `QuickLink`                            |
| 3   | "My Album" renders as "My Alb…"                   | Home `QuickLink`                            |
| 4   | "Library" renders as "Librar"                     | `PopTabBar` label — **not** the Home screen |
| 5   | Press/tap colour should be darker                 | Nothing darkened on press anywhere          |
| 6   | Play button should be lime with a radial gradient | `PopButton` `grass` tone                    |

Item 4 is worth flagging: `Library` is a tab label, so the fix lands in
`PopTabBar` and changes all four tabs, not just what is visible from Home.

---

## 2. Bug A — the trailing glyph is clipped (items 1, 4)

> **Superseded — the fix below shipped as `b86ca7a` and did not work on device.**
> The diagnosis in this section is kept as written, because it is what was believed
> at the time and the evidence against it only exists relative to it. See §9 for
> what the device showed and what replaced this.

Both affected words lose **exactly a `y`**, and that is the whole diagnosis.

Android measures a text node by its glyphs' _advance widths_, then clips drawing
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
_after_ the final glyph and then clips to the measured box, so letter-spacing
compounds exactly this failure on the label most likely to hit it.

## 3. Bug B — the label is genuinely too narrow (items 2, 3)

Different failure. The `…` here is _deliberate_: `da18ae2` added `flexShrink: 1`
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

| Approach                               | Why not                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| Widen the tiles                        | Only two fit across; the row is already full-bleed          |
| Shrink icon + gap + font, keep the row | Buys ~10pt. Fails again one notch further up the font scale |
| Cap `maxFontSizeMultiplier`            | Overrides an accessibility setting to protect a layout      |
| Shorten to "Daily" / "Album"           | The report was explicitly that the full words must show     |
| Keep the ellipsis                      | What was rejected                                           |

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

Green dominates relative luminance, so a green bright enough to read as _lime_
cannot carry white text at WCAG AA large-text (3.0:1). Measured against white:

| Candidate                                     | Contrast vs white |                                                   |
| --------------------------------------------- | ----------------- | ------------------------------------------------- |
| `grassDeep` `#659E12` (the current Play fill) | 3.25              | passes, barely                                    |
| `#6E9B0F`                                     | 3.30              | passes — but darker and barely limer than current |
| `#6AA513`                                     | 3.00              | fails                                             |
| `#6FAF14`                                     | 2.69              | fails                                             |
| `lime` `#8CCF1B`                              | 1.90              | fails                                             |

The ceiling for a white label lands essentially _at_ the colour already in use.
So "brighter lime" and "white label" are mutually exclusive here — the visible
change would have been almost nil.

Switching the label to `ink` resolves it with room to spare, and lets the lime be
genuinely bright:

| Stop        | Colour    | Contrast vs `ink` |
| ----------- | --------- | ----------------- |
| `limeLight` | `#A6E22E` | 8.79              |
| `lime`      | `#8CCF1B` | 7.18              |
| `limeDeep`  | `#5E9310` | 3.67              |

Every stop clears AA large text, including the darkest rim, which is the hard
case for a dark label.

| Alternative                                       | Why not                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Keep white, darken the lime to pass               | Delivers no perceptible change from today                              |
| Keep white, relax the contrast assertion          | 1.90:1 is unreadable in sunlight, and the guard exists on purpose      |
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

| File                                | Change                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| `src/shared/tokens.ts`              | `lime` / `limeLight` / `limeDeep`; `pressState`            |
| `src/shared/theme.ts`               | Re-export `pressState`                                     |
| `src/shared/ui/PressDarken.tsx`     | **New** — `usePressProgress`, `PressDarken`                |
| `src/shared/ui/PopButton.tsx`       | `lime` tone, `TONE_GRADIENT`, label ink room, press tint   |
| `src/shared/ui/PopTabBar.tsx`       | Label ink room, `letterSpacing` removed, darker focus pill |
| `src/features/home/home-screen.tsx` | Stacked quick links, press feedback, `tone="lime"`         |
| `src/shared/ui/index.ts`            | Export the press primitives                                |
| `src/shared/ui/PopButton.test.tsx`  | Gradient-stop contrast, fallback, ink-room guards          |

---

## 7. Verification

| Check                      | Status                                               |
| -------------------------- | ---------------------------------------------------- |
| `npm run typecheck`        | clean                                                |
| `npm run lint`             | clean                                                |
| `npm run format:check:src` | clean                                                |
| `npm test`                 | 195 passed, 26 suites                                |
| `npm run verify:build`     | deferred to CI (`.github/workflows/android-apk.yml`) |
| Device pass                | pending — see Open risk                              |

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
room _exists_, not that it is sufficient.

So this needs eyes on a real device at the default font scale and at a raised
one. If the tail still clips, the padding is too small rather than the diagnosis
being wrong, and the next step is raising it — not restructuring the layout.

This is the same class of failure the repo already got burned by once: the
offscreen-surface piece caching in `README.md`'s Known gaps, which typechecked,
linted, passed tests, and rendered every piece blank on device.

---

## 9. Revision — 2026-08-22, later the same day

§8 predicted that if the tail still clipped, "the padding is too small rather than
the diagnosis being wrong". The device says otherwise, so this section records what
actually happened and what changed.

### What the device showed

`b86ca7a` shipped §2's fix. On hardware:

- `Play` still renders **`Pla`**.
- `Library` still renders **`Librar`**.
- `Daily Puzzle` got **worse**. §3 removed `numberOfLines` on the reasoning that an
  unbounded label wraps rather than truncates. It does — but the tile was still only
  half the row wide, so instead of ellipsising to "Daily Puz…" it now wraps and
  shows bare **`Daily`**. The ellipsis was hiding how tight the tile actually was.

Two of the four labels were unchanged by a fix aimed directly at them. That is
evidence about the mechanism, not about the magnitude: adding horizontal ink room
and getting a pixel-identical result means horizontal ink room is not what was
missing.

### The diagnosis §2 got wrong

§2 asserted advance-width overhang as "the whole diagnosis" on the strength of one
correlation — both words end in `y`. The `y` evidence is real and still stands. What
does not follow is that the _horizontal_ extent of the `y` is the axis being cut.

A `y` is distinguished from every other letter in "Play" and "Librar**y**" by a tail
that goes **below the baseline**. Read vertically, the same evidence fits better:

- It explains why `paddingHorizontal` changed nothing.
- It explains why the failure is glyph-specific rather than width-specific — §2 was
  right that neither container is close to overflowing, which should have been a
  hint that width was not the axis.
- It points at a concrete budget that was being violated. `LABEL_LINE = 14` allotted
  14pt to an 11pt Nunito Bold line, whose box exceeds that once Android's
  `includeFontPadding` is counted. The descender sat outside the allotment.

### The clipping ancestor §2 never looked at

`PopSurface` sets `overflow: 'hidden'` on its inner face. `PopTabBar` and Home's
`QuickLink` both render inside one, so **two of the three broken labels had a real
clip in their ancestor chain** — and `b86ca7a` did not touch it. §2 reasoned only
about the text node's own paint box and never walked up the tree.

That clip is deliberate: `PopSurface.test.tsx` locks it in so nested photos follow
the rounded corner. So it became opt-out (`clip?: boolean`, default `true`, ~15 call
sites unaffected) rather than being removed, and only the two label-bearing surfaces
opt out.

### Why this round fixes several things at once

Normally one change per hypothesis is the right discipline. It is not available here:
**there is no Android SDK on this machine**, so no emulator and no local way to watch
a glyph draw. One hypothesis per cycle costs a push, a ~27-minute CI build and a
manual install — and `b86ca7a` already spent one of those to learn one negative fact.

So both axes and every clipping ancestor are addressed together. None of the changes
can make a label worse, and where a label could be given so much room that clipping
becomes structurally impossible rather than merely unlikely, that was preferred over
a tuned number.

### Changes

| #   | Report                    | Change                                                                                                                                     |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `Play` → `Pla`            | `lineHeight` ≈1.4x `fontSize` in `SIZE` (lg 22→30pt line); `paddingHorizontal` 3→8; `flexShrink: 0`; gradient moved off the label's parent |
| 2   | `Daily Puzzle` → `Daily`  | Tile now full width — Play's own edges — so ~340pt carries a ~95pt word; `clip={false}`                                                    |
| 3   | `My Album`                | **Deleted**, not fixed. Superseding item 3 of §1's table                                                                                   |
| 4   | `Library` → `Librar`      | `LABEL_LINE` 14→18; `lineHeight: 16`; `paddingHorizontal` 2→6; `clip={false}`                                                              |
| 5   | Splash had two animations | Bear's bob/sway removed; dots keep pulsing                                                                                                 |

Detail on the ones that are more than a number:

**The gradient moved off the face.** `experimental_backgroundImage` sat on the same
`Animated.View` that parents the Play label. It is an experimental RN 0.86 prop and
the only thing distinguishing Play from every other button in the app that renders
fine — so it was a live suspect for clipping its own children. It is now an
`absoluteFill` layer beneath the label, the pattern `PressDarken` already
established. Visually identical, parents nothing.

**`My Album` is gone.** It was only a second route into `library`, which the tab bar
reaches from every screen. Removing it also dissolved the two-tile `quickRow`, which
is what let Daily Puzzle become full width with no new width math — `styles.actions`
is already `alignSelf: 'stretch'`, so the tile inherits Play's edges exactly.

**`LABEL_LINE` 14→18 is not local.** It feeds `BAR_HEIGHT` and therefore
`useTabBarSpace`, so every `(tabs)/` screen now reserves 4pt more at the bottom.
That is the metric being centralised working as intended, not a side effect.

**The splash bear.** The loading screen had **three** animated things, not the two
reported: the bear's 14pt bob with 3.5° sway, the wordmark's spring-in, and the dot
pulse wave. The bob is removed on request; the dots now carry the whole "something is
happening" signal and the wordmark still rises in. The bear staying still is
defensible on its own terms — Android's splash window shows this same bear centred
and static from the moment the icon is tapped, so this bear is a continuation of one
already on screen, and animating it made the handoff read as a second screen
appearing.

### Files changed

| File                                | Change                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `src/shared/ui/PopSurface.tsx`      | `clip?: boolean` prop, default `true`                                             |
| `src/shared/ui/PopTabBar.tsx`       | `LABEL_LINE` 18, `clip={false}`, label room on both axes                          |
| `src/shared/ui/PopButton.tsx`       | `lineHeight` per size, label room, `flexShrink: 0`, gradient as its own layer     |
| `src/features/home/home-screen.tsx` | `My Album` removed, `quickRow` dissolved, Daily Puzzle full width, `clip={false}` |
| `src/shared/ui/LoadingScreen.tsx`   | Bear bob/sway removed                                                             |
| `src/shared/tokens.ts`              | `motion.loaderMinimum` comment no longer refers to a bob                          |
| `src/shared/ui/PopSurface.test.tsx` | `clip={false}` drops `overflow`, keeps the radius                                 |
| `src/shared/ui/PopButton.test.tsx`  | Ink-room test retargeted off the discredited theory                               |

### Verification

| Check                      | Status                |
| -------------------------- | --------------------- |
| `npm run typecheck`        | clean                 |
| `npm run lint`             | clean                 |
| `npm run format:check:src` | clean                 |
| `npm test`                 | 196 passed, 26 suites |
| `npm run verify:build`     | clean                 |
| Device pass                | pending               |

The retargeted `PopButton` test asserts three properties — padding, `lineHeight`
above `fontSize`, `flexShrink: 0` — and it is worth being blunt about what that is
worth: it pins them against silent regression and nothing more. §8's caveat holds
unchanged. No test in this repo can see a glyph.

### If a `y` still clips

Then the vertical theory is wrong too, and the next step is **not** more padding.
Isolate instead:

1. Temporarily set the Play label to a descender-free word. If it renders whole, the
   mechanism is descender-specific and the search is bounded. If it also clips, the
   `y` correlation was a coincidence twice over and the problem is elsewhere.
2. Check the tab bar and the button independently. §1 was right that item 4 lives in
   a different component; they may still be two bugs with two causes, and a shared
   symptom has already misled this document once.

---

## 10. Revision — 2026-08-22, third report

A new device report arrived with the same three symptoms: `Pla`, bare `Daily`,
`Librar`.

### Which build produced it

The symptoms match §9's _intermediate_ state exactly — `Daily Puzzle` wrapping to
bare `Daily` requires the half-width two-tile row that `3b2b56a` deleted, and the
complaint that the Daily tile should "align with Play" describes a layout where it
does not share Play's edges, which the full-width tile has done since `3b2b56a`.
So the likeliest explanation is that **the installed APK predates `3b2b56a`** and no
third clipping mechanism needs inventing yet. §9's changes may be fine; they have
simply never been seen on hardware.

That suspicion is recorded rather than acted on alone, because it cannot be verified
from here — and because reading the current code turned up one real defect that
survives regardless of which build was installed:

### The defect: fixed `lineHeight` around an auto-scaled font

Android scales a `Text` node's `fontSize` with the system font scale. An explicit
`lineHeight` does **not** scale. Every label touched by this document sets an
explicit line box, so on a device whose font size setting is raised even one notch,
the glyphs grow and the box does not — the exact vertical clip §9 diagnosed, reintroduced
by an accessibility setting rather than by the layout.

The fix scales each line box by `fontScale`, so the ratio between them is constant at
every setting. This is accessibility-preserving by construction; capping
`maxFontSizeMultiplier` was rejected for exactly this reason in §3's table and stays
rejected. No fixed number was retuned in the process — per §9's own rule, more padding
without device evidence would be guessing twice.

### Splash: down to one animation

§9 left the loading screen running two animations: the wordmark's spring-in and the
dot pulse. The report asked for one popup animation removed and one kept. The
wordmark's spring (`springs.pop`) is the popup; it now renders statically. The dot
wave is the one animation that remains — it is also the only one that can stay smooth
while the JS thread opens SQLite, which is the entire point of animating a loader.
The fade-out handoff is unchanged; it is how the screen leaves, not something it does.

### Files changed

| File                                | Change                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| `src/shared/ui/LoadingScreen.tsx`   | Wordmark spring-in removed; dots are the only animation    |
| `src/shared/ui/PopButton.tsx`       | Label `lineHeight` scaled by system `fontScale`            |
| `src/shared/ui/PopTabBar.tsx`       | Tab-label `lineHeight` scaled by system `fontScale`        |
| `src/features/home/home-screen.tsx` | Quick-link label `lineHeight` scaled by system `fontScale` |

### Verification

| Check                      | Status                                                   |
| -------------------------- | -------------------------------------------------------- |
| `npm run typecheck`        | clean                                                    |
| `npm run lint`             | clean                                                    |
| `npm run format:check:src` | clean                                                    |
| `npm test`                 | 196 passed, 26 suites                                    |
| Device pass                | pending — must be run against a build of **this** commit |

### What the next report must state

If letters are missing after installing a build of this commit, say so explicitly and
include the phone's **font size setting** (Settings → Display → Font size) — the first
useful isolation step is whether the failure tracks that setting, which no report so
far has mentioned.

---

## 11. Revision — device debugging session, same day again

The report finally named the variable: at the phone's default font size every label
renders whole; raise the font size and `Play` → `Pla`, `Daily Puzzle` → `Daily`,
`Library` → `Librar`. This time the phone was attached over USB with adb available,
so the failure was reproduced locally instead of guessed at.

### What the reproduction showed

With `font_scale 1.3` set over adb:

- The home screen shows `Pla`, bare `Daily`, and tab labels reading `Hom`,
  `Puzzl`, `Librar`, `Profil` — **including words with no descender**. §2's and §9's
  glyph-shape theories are both dead: whole trailing glyphs vanish regardless of shape.
- Maestro's accessibility dump reports the _full_ strings inside full-size boxes
  (`Play` laid out 187px wide) while a pixel map of the same region shows ink stopping
  cleanly after `Pla` — no partial glyph, no second line painted anywhere in the button.
- So layout succeeds and painting truncates. This is the RN 0.86/Fabric Android text
  pipeline failing specifically when its font-scale path engages, not a width budget
  anywhere in this app's styles.

### The fix that follows from the evidence

Stop using Android's broken path. Each label now sets `allowFontScaling={false}` and
multiplies its sizes by `fontScale` from `useWindowDimensions()` itself. The visual
result is identical scaling on every device and setting — the requirement — while the
text engine is handed final absolute numbers it measures correctly. Applied to
`PopButton`, `PopTabBar` and Home's quick links; §10's scaled-line-height change is
subsumed by this.

### Two bears on the splash

The report also clarified the splash complaint: there were **two bears** — the native
window's static bear, then `LoadingScreen`'s mascot beside the wordmark and dots.
"Remove one popup animation" meant remove the first. The plugin cannot run without an
icon resource (§splash.test.ts history), so the native window now carries a fully
transparent PNG (`splash-blank.png`) on the same sky: the launch reads as flat sky,
then one bear with wordmark and dots.

### My Album restored

Also on request. It returns stacked below "Daily Puzzle" at full width rather than
reopening the half-width two-tile row — that row is what let labels wrap at raised
scales in the first place.

### Files changed

| File                                | Change                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| `src/shared/ui/PopButton.tsx`       | Manual font scaling (`allowFontScaling={false}` × `fontScale`) |
| `src/shared/ui/PopTabBar.tsx`       | Same                                                           |
| `src/features/home/home-screen.tsx` | Same; My Album tile restored as a third stacked action         |
| `assets/images/splash-blank.png`    | New transparent icon for the native splash window              |
| `app.json`                          | Splash image → blank asset                                     |
| `src/shared/splash.test.ts`         | Rewritten for the blank-icon design                            |

### Verification

| Check                               | Status                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` / lint / format | clean                                                                                                             |
| `npm test`                          | 194 passed (two obsolete splash assertions retired)                                                               |
| Device pass                         | done as part of the fix loop: APK installed over adb, `font_scale 1.3` set, screenshots verified before reporting |
