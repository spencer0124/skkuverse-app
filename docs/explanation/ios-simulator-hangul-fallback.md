---
title: Hangul as Boxes in Web Views on the iOS 26.3 Simulator
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-26
audience: internal
---

# Hangul as Boxes in Web Views on the iOS 26.3 Simulator

> Why Korean text in a WKWebView renders as "?" boxes on the iOS 26.3 simulator while real
> devices and newer simulators are fine, and the font stack that fixes it without changing how
> a device renders. Read this when a web page shows boxes for Hangul on the simulator.

## Symptom

Every Hangul character in a web view draws as a box with a "?" in it (the LastResort glyph).
Latin letters and digits render normally, and native React Native text in the same app shows
Korean correctly. It happens for any page whose font stack starts with the system font
(`-apple-system`, `system-ui`), bundled or remote. It does not happen on a device.

## Cause

The iOS 26.3 simulator runtime has the Korean font — `Apple SD Gothic Neo` is in its
`System/Library/Fonts/Core`, byte for byte the same file as in 26.5 — but its system-font
fallback list hands Hangul to LastResort. WebKit treats `-apple-system` as the system font plus
that fallback list, so once the first family "covers" the character, no later family in the
stack is tried: naming `'Apple SD Gothic Neo'` third changes nothing.

Tried in Safari on a 26.3 simulator:

| Stack | Hangul on 26.3 |
| --- | --- |
| `-apple-system`, `system-ui`, either with `lang="en"` | Boxes |
| `'Apple SD Gothic Neo'` first, or any family before the system font | Renders |
| `@font-face { src: local('AppleSDGothicNeo-Regular') }` | Renders |

The same pages render correctly on the 26.5 simulator. Others have reported the same thing in
a Capacitor web view (top-jug/topjug-mvp#93). Emoji boxes on 26.3.x simulators
(facebook/react-native#56183) look like the same breakage.

## The fix

Put a face that covers **only Hangul** before the system font:

```css
@font-face{font-family:KoFallback;src:local('AppleSDGothicNeo-Regular');font-weight:400;unicode-range:U+1100-11FF,U+3130-318F,U+A960-A97F,U+AC00-D7AF,U+D7B0-D7FF}
/* …one face per weight the page uses: Medium 500, SemiBold 600, Bold 700 */
body{font-family:KoFallback,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',Roboto,sans-serif}
```

- Order matters: after `-apple-system` it does nothing.
- On a device it changes nothing visible, because Apple SD Gothic Neo is what the system picks
  for Korean anyway, and `unicode-range` keeps Latin and digits in SF.
- Where the font does not exist (Android), `local()` misses and the stack carries on as before.
- Putting `'Apple SD Gothic Neo'` first without `unicode-range` also fixes the simulator, but
  moves Latin and digits into that font's Latin glyphs on devices. Avoid it.

The bundled game pages use it: `KO_FACES` in `packages/subway-typing/scripts/build-embed.mjs`.
A page elsewhere (the pages in skkuverse-web, a mini app) needs the same faces in its own CSS
to render on this simulator. Running on a newer simulator runtime avoids the problem without
any code.
