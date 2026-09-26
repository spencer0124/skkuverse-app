---
title: The Mini-App Shell
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-26
audience: internal
---

# The mini-app shell

> How `app/mini-app.tsx` hosts a registered mini app on the miniapp protocol since 2026-09-25: what the app injects before a page's own script runs, how a message's origin is gated and dispatched, and how the registry's shell becomes chrome and a viewport. For anyone changing the shell or debugging why a page's message did nothing.

## Two doors, two protocols

Two screens load a page into a `react-native-webview`, and they no longer speak the same
language to it.

```text
  skkuverse://m/<slug>              skkuverse://webview?url=…, notice links,
  GET /miniapps/:id lookup          SDUI 'external', first-party SPA pages
          │                                          │
          ▼                                          ▼
  app/mini-app.tsx                          app/webview.tsx
  registered mini apps only                 any URL, minimal chrome
  @skkuverse/miniapp/protocol               @skkuverse/bridge (v1)
```

`app/mini-app.tsx` only ever opens a slug the server's registry knows about
(`GET /miniapps/:id`); everything else — a notice's source page, a link inside notice markdown,
an SDUI `external` target — goes through `app/webview.tsx`, which still speaks the older
`@skkuverse/bridge` message set unchanged. Both screens share one origin match,
`bridgedOrigin` in `features/webview/capabilities.ts`, but hand it to a different resolver:
`resolveWebviewCapabilities` for `/webview`, `resolveMiniAppCapabilities` for `/mini-app`. This
document covers the second door only; the first is `packages/bridge/README.md` and ADR 0006 §9.

One URL crosses from the first door to the second: a URL whose origin belongs to a first-party
mini app. `openWebView` looks it up in `getMiniAppOrigins()` (GET /app/config `miniapps.origins`,
server-owned, one mini app per origin) and opens that mini app's shell at the URL's path instead
(`miniAppTargetForUrl`). Without this, a place-detail link or a banner pointing at, say,
`eskara.miniapp.skkuverse.com/eskara/entry` would load in `/webview`, where the page's
`MiniappRoot` finds no `window.skkuverse` and shows its "open in the app" page. The rule is the
one App Links and Universal Links use: the host that owns a URL decides where it opens, not the
action that linked to it.

## What a page finds before its own script runs

Before content loads, the screen builds `hostBootstrapScript({ capabilities, viewport })` and
hands it to the WebView's `injectedJavaScriptBeforeContentLoaded`. It defines a frozen global:

```ts
window.skkuverse = Object.freeze({
  protocol: 1, // envelope version, not a feature list
  capabilities: [...], // method names this page may use
  getViewport(), // a fresh copy of the current Viewport
  receive(json), // app → page delivery, called by the app via injectJavaScript
});
```

The object is frozen and defined with `writable: false, configurable: false`, so a page script
cannot replace or extend it. `capabilities` is an **advertisement, never a grant** — a page uses
it only to decide whether to draw a button at all. What actually runs, or doesn't, is decided
fresh on every single message that arrives, never off this list.

The CSS side of the same injection sets `--sv-safe-*`, `--sv-content-*`, `--sv-inset-*` and
`html[data-sv-chrome]` on `<html>` as early as the document allows, so first paint already has
them. That part of the script lives in the protocol package (`hostBootstrapScript`
in skkuverse-miniapp), not in this app, so what the variables are is defined once, next to the
types.

## The origin gate: re-decided per message

`resolveMiniAppCapabilities(pageUrl, allowedOrigins)` returns every notify method the protocol
defines (`NOTIFY_METHODS`) when `pageUrl`'s origin matches the server-owned allowlist
(`BRIDGE_ORIGINS`, served at `GET /app/config` as `webview.bridgeOrigins`), and an empty array
for anything else. There is no partial grant today: the curated phase has one trust level, a
bridged origin is ours, so all-or-nothing is the whole rule.

The handler re-runs that resolver against `event.nativeEvent.url` on every `onMessage`, not
once at open time. A WebView navigates, and a grant fixed when the screen mounted would
outlive the origin it was granted to — the same reasoning `/webview`'s gate already used, now
shared through `bridgedOrigin` rather than duplicated. Fails closed throughout: no config yet, a
failed fetch, an unparseable URL or a plain mismatch all read as `[]`.

> [!WARNING]
> On Android a child iframe can post to the bridge while `nativeEvent.url` reports only the
> top-level document. A bridged mini-app origin that ever embeds an untrusted iframe would leak
> its grant to it. Today's mini apps embed none — an invariant of the allowlist, not a property
> of this code (see `capabilities.ts`).

The capability list baked into the bootstrap script is resolved once, from the **start URL's**
origin, before the WebView exists. It only advertises truthfully for the page it was computed
for; if that page later navigates to a different origin, the advertised list can lie, but the
per-message gate behind it does not, so nothing the page believed it could do actually runs.

## Dispatch: one message in, at most one effect out

`features/mini-app/dispatch.ts` runs every incoming message through the protocol's
`parseMessage` first. Anything that fails to parse is dropped without a word.

- **A request** (it carries an `id`) always gets exactly one response, so a page never waits out
  a timeout. It answers `denied` when the posting origin has no grant at all, and `unsupported`
  otherwise — the protocol defines no request method yet, so *any* request today is unknown by
  construction, and the first one added becomes a case here rather than a protocol change.
- **A notification** (no `id`) runs only when its `method` is in the granted set, and is dropped
  silently otherwise, with no answer either way.

The notify methods map onto the app's existing effects:

| Method | Effect | Notes |
| --- | --- | --- |
| `haptic.impact` | `playWebHaptic(style)` | |
| `link.open` | `openAppFirst({ url, appUrl })` | Tries `appUrl`'s scheme first, falls back to `Linking.openURL(url)` |
| `map.openPlace` | `performWebAction('map', place)` | Same `resolveWebAction` + `handleSduiAction` path the old `web:action` `map` took |
| `miniapp.open` | `performWebAction('miniapp', target)` | Same path, for `miniapp` |
| `analytics.track` | `logMiniAppEvent({ miniAppId, event })` | The wired effect takes the method's `event` name and drops `params` — only the **event name** reaches GA4, as `miniapp_event` |
| `app.ready` | ignored | The effect is a no-op; the shell does not act on the handshake |
| `shell.set` | `setShellPatch` | Merged over the registry shell at render time, see below |

A method the protocol can parse but this switch does not cover falls through and is dropped —
reachable only if `granted` ever lists more than the switch handles.

Every effect is injected as a plain function rather than called directly, which keeps
`dispatch.ts` free of relative and React Native imports, so `node --experimental-strip-types
--test` exercises it without a Metro resolver (`dispatch.test.mts`).

## Replies re-check the origin, not just the intent

`deliver(origin, message)` calls `webRef.current?.injectJavaScript(hostDeliverScript(origin,
message))`. That script checks `location.origin` against the origin the reply was computed for
before it calls `window.skkuverse.receive`, and does nothing if they differ. The same script
carries `viewport.changed` events, so a page that has already navigated away between a request
landing and its answer being ready never receives either.

## Shell: the registry decides the chrome

`GET /miniapps/:id` returns `MiniAppDetail.shell`, always a **complete** `ShellConfig` —
`bar`, `header`, `statusBar`, `background`. skkuverse-server builds it by merging, in order, the
default, the registry entry, and the mini app's own `public/skkuverse.json` manifest (fetched
from the page's own origin for first-party mini apps), so the client never has to reason about a
partial shell: a field the server garbles or omits falls back to `DEFAULT_SHELL` on the client
side too (`parseMiniAppDetail`, `packages/shared/src/miniapps/schema.ts`).

| Field | Values | What it changes |
| --- | --- | --- |
| `bar` | `top`, `bottom`, `none` | Where the service pill goes: beside the header's back button, in a floating bottom bar with back/forward, or nowhere |
| `header` | `opaque`, `overlay` | Whether the page starts below a solid header, or at the very top under a transparent one |
| `statusBar` | `dark`, `light` | Status bar icon colour |
| `background` | `#RRGGBB` | Painted behind the WebView while it loads and on overscroll |

Rendering follows directly:

- **`bar: 'bottom'`** draws the floating pill-and-chevrons bar. Nothing draws for any `bar`
  value until the registry detail has actually arrived — the local `bar` state starts `null`
  rather than assuming `'bottom'`, because guessing wrong flashes the bar on screen before a
  `'top'` mini app's real shell replaces it.
- **`header: 'opaque'`** (the default) leaves the native header solid, and the WebView starts
  below it. On Android that is react-native-screens' own layout. On iOS the header is laid out
  translucent (`headerTransparent: true`) but painted solid with the shell's `background`, and
  the screen pushes the WebView down itself with `paddingTop` equal to the header height. It
  looks the same; the reason is the back swipe (see below).
- **`header: 'overlay'`** sets `headerTransparent: true` with a transparent `headerStyle`, and
  the WebView starts at `y = 0` under the status bar. The page insets itself with
  `--sv-inset-top`.
  - With Liquid Glass available (`GLASS_AVAILABLE`, from `expo-glass-effect`'s
    `isLiquidGlassAvailable()`, iOS 26+), the system draws the back and more buttons as glass
    capsules floating over the transparent header on its own.
  - Without it — older iOS, Android — the screen draws its own back/more buttons as
    `GlassIconButton` (the SDS white-circle-and-shadow fallback), because a plain transparent
    header's system buttons would otherwise have no background and vanish into the page.
- **`contentInsetAdjustmentBehavior` is always `'never'`**, and
  `automaticallyAdjustContentInsets` is `false`. Insets are entirely the page's job through
  `--sv-inset-*` now; the fixed `contentInset` the bottom bar used to reserve is gone. A page
  that does not read the CSS variables no longer gets any inset for free.

`shell.set` can only touch `header`, `statusBar` and `background` at runtime — `bar` is a layout
decision, so its type excludes the field entirely (`ShellPatch = Partial<Pick<ShellConfig,
'header' | 'statusBar' | 'background'>>`), and only the manifest can move it.

## The iOS back swipe: the WebView's frame stays put

The screen under the mini-app shell, `(tabs)`, has no header. When an interactive pop starts,
react-native-screens applies that screen's config and hides the navigation bar. While the bar
is hidden it reports a header height of `0` (`calculateHeaderHeightIsModal`). Under a solid
header, react-native-screens offsets the content by that height. So a back swipe that was
started and then let go moved the WebView's frame twice mid-gesture. The page came back
scrolled to the top (first seen in 인자셔틀).

Four guards now keep the page where it was (`features/mini-app/useSwipeGuard.ts`, with the pure
rules in `swipe-guard.ts` and `swipe-guard.test.mts`):

- **The frame no longer follows the bar.** On iOS the header is always translucent, so the
  screen's bounds do not depend on whether the bar is shown. An opaque shell gets its offset
  from the screen's own `paddingTop` instead.
- **The header height holds still while the screen is leaving.** From a closing
  `transitionStart` until `transitionEnd` or `gestureCancel`, the height the screen lays out
  with, and feeds to `computeViewport`, keeps its last value. It never drops to `0`. An overlay
  mini app therefore gets no `viewport.changed` with `top: 0` mid-swipe.
- **A cancelled swipe restores the scroll.** The screen always records the WebView's
  `contentOffset.y`. If the offset is under half of where it was 150 ms after `gestureCancel`,
  and no load started in between, it injects `window.scrollTo`. This only reaches pages whose
  document scrolls. A page that scrolls an inner container reads as offset `0` and is left
  alone.
- **The start URL is pinned.** Once `initialUrl` is known it no longer changes for the life of
  the screen. A registry refetch that returns a slightly different `startUrl` would otherwise
  change `source` and reload the page.

This covers the `/mini-app` shell only. `/webview` has the same header arrangement and has not
been changed.

## `computeViewport`: what the page is told to avoid

`features/mini-app/viewport.ts` is pure and free of React Native imports, tested under
`node --test` across the full header × bar × glass matrix (`viewport.test.mts`). Given the
shell, the device's safe-area insets, the native header's measured height and the floating
bottom bar's own height, it returns:

- **`safeArea`** — what the device itself covers wherever the WebView actually reaches it.
  `top` is the device inset under `header: 'overlay'` and `0` under `'opaque'`, since an opaque
  header means the WebView never reaches the status bar in the first place. `bottom`, `left`
  and `right` are always the device insets — the WebView always reaches those edges.
- **`contentSafeArea`** — what the shell's own chrome covers. `top` is the header's height past
  the status bar, but only under `'overlay'`. `bottom` is the floating bar's height, but only
  under `bar: 'bottom'`. `left` and `right` are always `0`: the chrome floats over the top and
  bottom bands alone.
- **`chrome`** — `'glass'` only when Liquid Glass is available **and** something is actually
  drawn over the page (an overlay header or a bottom bar); an opaque header with no bottom bar
  covers nothing, whatever the OS can offer.

Every number is rounded to a whole CSS pixel and clamped non-negative, because `useHeaderHeight`
can transiently report a bogus value before its own layout has settled.

## `viewport.changed`: sent once per real change

The screen keeps the last viewport it delivered and fires `viewport.changed` to the current
page's origin only when the freshly computed viewport differs from that (`sameViewport`). The
very first value is never sent as an event — it already reached the page inside the bootstrap
script — so nothing goes out until the viewport genuinely moves: a rotation, the header settling
its height, or a `shell.set` patch that changes what the chrome covers.

## Known limits, at time of writing (2026-09-26)

- **Not yet verified on a physical device.** Built and exercised against the simulator/emulator
  plus the two unit-test matrices above; the Liquid Glass fallback path and the iOS edge-swipe
  back handoff in particular still want a real-device pass. So does the back-swipe guard: the
  simulator's edge gesture always completed the pop, so a cancelled swipe has not been observed
  there.
- **The Android child-iframe caveat applies here too** (see the warning above): the origin gate
  trusts the top-level document's URL, so an embedded untrusted iframe on a bridged origin would
  inherit that origin's grant.
- **A page still coded for the old, v1 bridge shape loses its buttons rather than erroring.** The
  shape the old `web:action` era pages checked, `window.skkuverse?.bridge?.actions?.includes(...)`
  (see `add-view-on-map-button.md`'s `canOpenMap()`), does not exist on the new
  `window.skkuverse` at all — it is `{ protocol, capabilities, getViewport, receive }` now, with
  no `.bridge`. Such a check reads `undefined` and the button simply never shows; nothing
  crashes. A page has to move to `capabilities.includes('map.openPlace')` to see it appear again.

## Related

- [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md) — decisions 4 and 5, and
  the "mini app shell moves to the miniapp protocol" note in §9
- [skkuverse-miniapp `docs/reference/protocol.md`](https://github.com/spencer0124/skkuverse-miniapp/blob/main/docs/reference/protocol.md) —
  the protocol's own source of truth: messages, the manifest, the viewport, the host object
- [add-view-on-map-button.md](../how-to/add-view-on-map-button.md) — wiring a `map.openPlace`
  button into a mini app page
- [packages/bridge/README.md](../../packages/bridge/README.md) — the v1 contract `/webview`
  still speaks
- [docs/README.md](../README.md) — writing rules
