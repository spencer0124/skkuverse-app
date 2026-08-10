---
title: Splash Animation (SKKUverseSplash)
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# Splash Animation (SKKUverseSplash)

> How the Toss-style brand animation shown during the OTA check and app initialisation is built, what changed when porting the web prototype to Reanimated, and how it hands off to InitGate. Read this before tuning the splash motion or touching the init flow.

## Background

The app needed a brand animation to show while it checks for an OTA update and initialises.
The motion is a Toss-style one where the "스꾸버스" wordmark splits apart and becomes <!-- conventions:allow-korean: the wordmark the app renders -->
"스꾸유니버스". A web prototype, `skkuverse-splash.jsx`, was ported one to one to React Native <!-- conventions:allow-korean: the wordmark the app renders -->
and Reanimated. Several CSS features have no React Native equivalent — per-property
transitions, gradients, filter blur, em units — so each needed a substitute, and those
mapping decisions are what this document is about.

## Where the code is

| File | Role |
| --- | --- |
| `src/providers/SKKUverseSplash.tsx` | The animation component |
| `src/providers/InitGate.tsx` | OTA and init gating, plus managing the splash overlay |
| `Downloads/skkuverse-splash.jsx` | The original web prototype, for reference |

## The timeline

```text
t=0       mount, a white screen with the wordmark centred
t=800ms   step 1 — split, the two halves move apart (0.85s TOSS_SPRING)
t=1150ms  step 2 — reveal, the inserted syllables' container maxWidth goes 0 → open (0.9s SMOOTH)
t=1230ms  first inserted character appears (opacity 0.45s ease + transform 0.85s TOSS_SPRING)
t=1310ms  second inserted character appears, staggered by 80ms
t=1900ms  step 3 — settle, the accent line, subtitle and glow appear
t=2600ms  step 4 — settled, waiting to dismiss
```

## What changed porting from web to React Native

### 1. CSS `cubic-bezier` becomes `Easing.bezier`

The three curves the web version depends on map exactly onto Reanimated's `Easing.bezier`:

```text
Web CSS                                    RN Reanimated
─────────────────────────────────────────────────────────
cubic-bezier(0.34, 1.56, 0.64, 1)  →  Easing.bezier(0.34, 1.56, 0.64, 1)  // TOSS_SPRING
cubic-bezier(0.16, 1, 0.3, 1)     →  Easing.bezier(0.16, 1, 0.3, 1)      // SMOOTH
cubic-bezier(0.0, 0.0, 0.2, 1)    →  Easing.bezier(0.0, 0.0, 0.2, 1)     // DECEL
```

**This matters.** The first attempt approximated it with
`withSpring({ damping: 14, stiffness: 120, mass: 1 })`, which overshoots by only 7.4%. The
web's TOSS_SPRING overshoots by **56%**, so `withTiming` with the exact bezier curve is
required.

### 2. Multiple CSS transitions become separate shared values

CSS can give one element a different transition per property:

```css
transition: opacity 0.45s ease,           /* a fast fade-in */
            transform 0.85s SPRING,        /* a slow bounce */
            filter 0.5s ease;              /* the blur fading out */
```

Driving every property from one Reanimated shared value applies the same curve to all of
them, and **the bounce disappears**.

**The fix** is a separate shared value per property:

```tsx
// opacity — fast ease-in (0.45s)
c1Opacity.value = withTiming(1, { duration: 450, easing: Easing.ease });

// transform — slow TOSS_SPRING with 56% overshoot (0.85s)
c1Transform.value = withTiming(1, { duration: 850, easing: TOSS_SPRING });
```

A character **appears quickly** while its position **keeps bouncing** into place, which is
the core of the Toss feel.

### 3. A CSS `max-width` transition becomes Reanimated `maxWidth`

The web version reveals the inserted syllables like this:

```css
max-width: isRevealing ? "4.8em" : "0em";
transition: max-width 0.9s SMOOTH;
```

Animating `width` was tried first, and it forces the container to a fixed size. Whenever that
size exceeded the text's real width, empty space appeared on the right and **the centring
went wrong**.

**The fix** is `maxWidth`. The container sizes itself to its content, and maxWidth only
clips:

```tsx
const revealAnim = useAnimatedStyle(() => ({
  maxWidth: interpolate(reveal.value, [0, 1], [0, revealTargetW]),
}));
```

### 4. CSS gradients become react-native-svg

React Native has no CSS gradients, so `react-native-svg` reproduces them exactly.

**The accent line**, transparent to green to transparent:

```tsx
<SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
  <Stop offset="0" stopColor={GREEN_LIGHT} stopOpacity={0} />
  <Stop offset="0.5" stopColor={GREEN_LIGHT} stopOpacity={1} />
  <Stop offset="1" stopColor={GREEN_LIGHT} stopOpacity={0} />
</SvgLinearGradient>
```

**The radial glow**, `rgba(43,90,58,0.08)` to transparent:

```tsx
<SvgRadialGradient id="glow" cx="50%" cy="50%" r="50%">
  <Stop offset="0" stopColor={GREEN} stopOpacity={0.08} />
  <Stop offset="0.7" stopColor={GREEN} stopOpacity={0} />
</SvgRadialGradient>
```

### 5. CSS `filter: blur()` becomes an animated `textShadowRadius`

The web's `filter: blur(0.8px)` softens the text pixels themselves. After trying several
approaches in React Native, animating `textShadowRadius` won.

#### What was tried, and why each failed

| Approach | Result |
| --- | --- |
| An `expo-blur` BlurView overlay | Produces the iOS frosted glass effect through UIVisualEffectView, which is a fundamentally different thing from a CSS filter blur. Its rectangular edge is clearly visible, and it lays glass over the text rather than softening the text |
| └ Animating the overlay's opacity | Lowering the wrapping parent's opacity from 1 to 0 makes the whole layer transparent rather than weakening the blur, so almost no blur is visible |
| └ Animating intensity directly | `Animated.createAnimatedComponent(BlurView)` with `animatedProps` animating intensity 100 to 0. The blur is strong, but **the rectangular edge remains**, which is structural to frosted glass |
| └ Changing tint from "light" to "default" | On a white background the tint difference is negligible, and the edge problem is unchanged |
| `filter: [{ blur: X }]` on RN 0.76+ | React Native's filter blurs the Text view's own pixels, which are the text **and its transparent background**. CSS blurs within the parent's rendering context, the white background, so it looks natural; React Native turns the transparent background translucent and leaves a **grey or white rectangular artifact** |
| **Animating `textShadowRadius`** | **Adopted.** A glow appears around each character and fades, which reproduces the blurred-to-sharp transition naturally, with no bounding box artifact |

#### The implementation

Each character's `textShadowRadius` animates from 8 to 0 through a Reanimated shared value:

```tsx
// shared values
const c1Shadow = useSharedValue(8);
const c2Shadow = useSharedValue(8);

// inside play() — matching the web's filter 0.5s ease
c1Shadow.value = withDelay(T.CHAR_1, withTiming(0, { duration: 500, easing: Easing.ease }));
c2Shadow.value = withDelay(T.CHAR_2, withTiming(0, { duration: 500, easing: Easing.ease }));

// animated style
const c1Anim = useAnimatedStyle(() => ({
  opacity: c1Opacity.value,
  textShadowColor: 'rgba(43, 90, 58, 0.5)',  // a translucent green
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: c1Shadow.value,
  transform: [...],
}));
```

Combined with the existing opacity and slide animations, a character arrives with a glow and
then sharpens, close to what the web version does.

### 6. CSS `em` units become explicit arithmetic

In CSS, `em` resolves against a different font-size depending on context:

```text
letterSpacing: "0.28em"  → against the element's own fontSize
marginTop: "0.85em"      → against the fontSize inherited from the parent, 16px by default
transform: "-0.12em"     → against baseStyle's fontSize
```

In React Native every em value is computed directly:

```tsx
// letterSpacing — against the element's own fontSize
letterSpacing: subtitleFontSize * 0.28

// marginTop — against the inherited 16px, the CSS default
marginTop: EM_BASE * 0.85  // EM_BASE = 16

// transform — against the main fontSize
translateX: -(fontSize * 0.12)
```

### 7. CSS `clamp()` becomes `Math.min(Math.max())`

```text
Web: clamp(2.6rem, 10vw, 5.6rem)
RN:  Math.min(Math.max(screenW * 0.1, 42), 90)

Web: clamp(0.65rem, 2vw, 0.85rem)  // subtitle
RN:  Math.min(Math.max(screenW * 0.02, 10.4), 13.6)
```

### 8. The split is asymmetric

The web original split both halves symmetrically. The app changed to an asymmetric layout so
the inserted syllables read as one word with the right-hand half:

- The left half moves left, opening the gap.
- The right half does not move, so it stays joined to the inserted syllables.

```tsx
// only the left half translates — the right one moves solely from the reveal's layout push
splitL.value = withDelay(T.SPLIT, withTiming(1, { duration: 850, easing: TOSS_SPRING }));
// splitR is never animated, so it stays at 0
```

The right half is pushed rightward by the reveal container's `maxWidth` growing, and with no
additional `translateX` it sits flush against the inserted syllables.

## How it hands off to InitGate

### The overlay

Previously, blocking:

```text
phase=ota/init → return a static splash, children never render
phase=ready   → return children
```

Now, an overlay:

```text
children always render, with SKKUverseSplash covering them at absoluteFillObject
isReady=true and the animation settled → the splash fades out → onDismiss
```

**Why:** it prevents the empty frame where children are invisible when phase resets on
resume.

### isReady and onDismiss

```tsx
<SKKUverseSplash
  isReady={phase === 'ready'}          // true once OTA and init finish
  onDismiss={() => setShowSplash(false)} // remove the splash after the fade-out
/>
```

- When `isReady` turns true before the animation finishes, it **waits for the animation**
  and then dismisses.
- When the animation finishes while `isReady` is still false, it shows **waiting dots**, a
  breathing pulse.
- Together those two make the transition feel natural whether the OTA check is fast or slow.

### The waiting dots

When `settled && !isReady`, three dots breathe:

```tsx
withRepeat(
  withSequence(
    withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
    withTiming(0.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
  ),
  -1, false,
)
```

Each dot is staggered by 150ms, which gives the loading ripple.

## Tuning guide

| Parameter | Current value | How to adjust |
| --- | --- | --- |
| `revealTargetW` | `fontSize * 2.1` | Sized for IBM Plex Sans KR. Raise it if the text clips on a real device |
| Initial `textShadowRadius` | `8` | Higher widens the glow, lower makes it subtle. Corresponds to the web's blur(0.8px) |
| `textShadowColor` opacity | `0.5` | Higher deepens the glow, lower softens it |
| Shadow duration | `500ms` | The same as the web's `filter 0.5s ease` |
| `TOSS_SPRING` bezier | `(0.34, 1.56, 0.64, 1)` | y1 = 1.56 is what sets the overshoot |
| Split distance | `fontSize * 0.12` | The same as the web, 0.12em |
| Character slide distance | `fontSize * 0.6` | The same as the web, 0.6em |

## A note on releasing

The splash is JS-only, so it travels over OTA. Changing the font, IBM Plex Sans KR, does not:
the `expo-font` plugin embeds fonts natively, so that needs a native rebuild.

```bash
npx expo prebuild --clean    # regenerate the native project
npx expo run:ios             # build and run
```

## Related

- [../how-to/ota-update.md](../how-to/ota-update.md) — publishing an OTA, for JS-only changes
- [docs/README.md](../README.md) — the writing rules
