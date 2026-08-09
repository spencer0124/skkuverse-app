---
title: Deep Link Reference
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# Deep Link Reference

> The whitelist contract for the `skkuverse://` custom scheme and `https://skkuverse.com/p/...` universal links. Read this before adding or changing a deep link path, or when debugging how the app was entered.

## Summary

Every deep link that enters a specific screen from outside passes through one function,
`redirectSystemPath()` in `apps/mobile/app/+native-intent.tsx`. The custom scheme and
universal links share the same whitelist, and **the whitelist, the notice intercept and the
mini app intercept all apply identically on a cold start (`initial: true`) and a warm one
(`initial: false`)**. That uniformity is what stops an untrusted deep link from pushing an
arbitrary internal route such as `/login` or `/onboarding`. Cold and warm diverge at exactly
one point, the bare `/` branch, described under
[Cold start vs Warm start](#cold-start-vs-warm-start).

## Configuration

| Item | Value | Defined in |
| --- | --- | --- |
| Custom scheme | `skkuverse://` | `apps/mobile/app.config.ts`, `scheme: "skkuverse"` |
| Universal link | `https://skkuverse.com` with the `/p/` prefix | iOS `associatedDomains`, Android `intentFilters` |
| Filter entry point | `redirectSystemPath()` | `apps/mobile/app/+native-intent.tsx` |
| Path normalisation | `parseIncomingLink()` | `packages/shared/src/utils/normalizeIncomingPath.ts` |
| Routing | Expo Router, file-based, with no separate linking config | `apps/mobile/app/` |

The `/p/` prefix keeps universal links in their own namespace, away from the homepage's own
paths. Inside the app, `parseIncomingLink()` strips `/p/` before the whitelist runs, so every
path in the tables below is written as it looks after stripping.

### `/p/` is the "shared link" namespace, not a web twin of every route

Deep links come in two kinds, and only one of them gets `/p/`.

| Kind | Entry paths | Purpose | Examples |
| --- | --- | --- | --- |
| **Shared link** | `skkuverse://…` plus `https://skkuverse.com/p/…` | A link a person sends to someone else. Opens the app when installed, and falls back to a web landing page when not | Notices, mini apps |
| **Navigation shortcut** | `skkuverse://…` only | Opens a screen from inside the app, a QR code, or a push | Home, campus, transit, search, floor map, map place |

> [!IMPORTANT]
> **A path gets a `/p/` entry on one condition: a web landing page exists for it.**
> No fallback, no `/p/`. A link that shows a 404 to someone without the app is not a shared
> link.
>
> Nobody sends "open the campus tab" to a friend as a web URL, and there would be no page to
> open if they did. Navigation shortcuts use the custom scheme alone, which is a design
> choice rather than an omission.

When adding a path, **build the web landing page first**, then add it to the AASA `paths`.
Doing it the other way round publishes a broken link to everyone without the app.

### Universal links need more than app configuration

An app **claiming** a path and the OS **allowing** that claim are separate things, and a link
reaches the app only when both agree.

| Layer | Where | What it decides |
| --- | --- | --- |
| iOS allowlist | `skkuverse.com` `/.well-known/apple-app-site-association` (**web repo**) | Which paths go to the app, including exclusions such as `NOT /privacy` |
| Android allowlist | `skkuverse.com` `/.well-known/assetlinks.json` (**web repo**) | Host-level authorisation (`handle_all_urls`) |
| The app's claim | `app.config.ts`, `android.intentFilters[].data.pathPrefix` | Which paths the app actually intercepts |

**The Android `pathPrefix` has to be `/p/`, with the trailing slash.** `pathPrefix` is a
plain string prefix, so `/p` also matches `/privacy`, which fixes nothing. While that filter
was unbounded, Android intercepted **every** URL on `skkuverse.com`. Tapping the privacy
policy opened the app, which hit the whitelist and redirected to home. iOS was excluded from
the start by the AASA `NOT` rule.

> [!IMPORTANT]
> `intentFilters` is native configuration. A change needs
> `npx expo prebuild --platform android` and a rebuild, and **does not travel over OTA.**

## Allowed paths

### Shared links (custom scheme and `/p/` universal links)

These have a web landing page, so a device without the app falls back automatically. **This
table alone** is what belongs in the AASA `paths`.

| Custom scheme | Universal link | Screen | Handling |
| --- | --- | --- | --- |
| `skkuverse://notices/<sourceId>/<articleNo>` | `https://skkuverse.com/p/notices/<sourceId>/<articleNo>` | Notice detail | `NOTICE_PATH_RE` intercept |
| `skkuverse://m/<slug>` | `https://skkuverse.com/p/m/<slug>` | Mini app | `MINIAPP_PATH_RE` intercept |

### Navigation shortcuts (custom scheme only)

For entry from inside the app, a QR code, or a push. They are not shared, so they have **no**
`/p/` universal link, because there is no web page to open.

| Custom scheme | Screen | Handling |
| --- | --- | --- |
| `skkuverse://` | Home tab, or the last tab on a cold start | The bare `/` branch |
| `skkuverse://home` | Home tab | `TAB_PATHS` mapping |
| `skkuverse://campus` | Campus tab | `TAB_PATHS` mapping |
| `skkuverse://transit` | Transit tab | `TAB_PATHS` mapping |
| `skkuverse://map/hssc` | Humanities campus map | Passes `ALLOWED_PATHS` |
| `skkuverse://search` | Building and space search | Passes `ALLOWED_PATHS` |
| `skkuverse://map?place=<placeId>` | Campus tab with that place's sheet | `MAP_PATH_RE` intercept, described below |

Anything outside those two tables redirects to home, `/(tabs)/home`. An exception thrown
while parsing a path redirects there too, through a `try/catch`.

> [!NOTE]
> **The app does not distinguish `/p/`.** `parseIncomingLink()` strips it and runs the same
> whitelist, so a navigation shortcut sent with `/p/` works fine once it reaches the app.
> What separates the two tables is **whether the path is listed in the AASA**, which is to
> say whether someone without the app has anywhere to go.
>
> Tidying the AASA is work in the **web repo**
> (`skkuverse.com/functions/.well-known/apple-app-site-association.ts`). The target state is
> the `NOT` rule plus `/p/notices/*` and `/p/m/*`, and `/p/campus`, `/p/transit`,
> `/p/search`, `/p/map/*` and `/p/bus/*` are all removal candidates because none has a
> fallback. Keep the `NOT` rule first in the list: AASA takes the first match.

### Variable path 0: map place (`/map?place=<placeId>`)

**This scheme is general-purpose.** A building and a booth are both "a place", so they open
through the same address space (umbrella ADR 0004, invariant 1). An event-only variant would
guarantee that next year's event demands another new scheme.

- `MAP_PATH_RE = /^\/map$/` is **an intercept**, which is a different mechanism from a
  whitelist entry. Adding `/map` to
  `ALLOWED_PATHS` as well would create a second, unreachable path through this function.
  Notices and mini apps have no whitelist entry for the same reason.
- **`/map/hssc` is unaffected.** The pattern ends at `/map`, so a path carrying another
  segment fails to match and flows on to the whitelist, which sends it to the SVG floor map.
- `placeId` is checked for **shape only** (`/^[a-z0-9-]+$/`) and never looked up. The reason
  matches the mini app slug: this function runs outside the React tree, so a lookup here
  would duplicate the request and block the first navigation. Path traversal such as
  `../../etc` is caught by that pattern.
- An id that matches nothing is either never stashed in `pendingMapPlaceLink` or never
  resolved from the snapshot, so the user **arrives at the campus tab with no sheet**. There
  is no error screen.
- The consumer is **`CampusScreen`**, not the root layout. `redirectSystemPath` has already
  returned `/(tabs)/campus`, so it is guaranteed mounted, and it is the only place that can
  resolve a placeId.

### Variable path 1: notice detail (`/notices/<sourceId>/<articleNo>`)

sourceId and articleNo vary and cannot be enumerated in a static whitelist, so
`NOTICE_PATH_RE = /^\/notices\/([a-z0-9-]+)\/(\d+)$/` pattern-matches *before* the whitelist
check. The anchors (`^...$`) block partial-match bypasses, so `/notices/cse/5847/extra` does
not match and redirects to home.

> [!NOTE]
> A matched notice path never passes through to expo-router's static route handler at
> `app/notices/[sourceId]/[articleNo].tsx`. `redirectSystemPath` stashes the
> `(sourceId, articleNo)` intent with `pendingExternalNoticeLink.set(...)` and returns
> `/(tabs)/notices`. The root layout's `PendingNoticeLinkConsumer` consumes that intent and
> pushes the detail screen as a follow-up above the notices tab. The point is to send the
> back gesture to the notices tab rather than to whichever tab happened to be active when
> the link arrived.

When someone without the app taps the universal link, a Cloudflare Pages Function at
`skkuverse.com/p/notices/<sourceId>/<articleNo>` renders the notice body, with OG meta, an
iOS smart banner, and a JS CTA fallback for Android.

### Variable path 2: mini app (`/m/<slug>`)

`MINIAPP_PATH_RE = /^\/m\/([a-z0-9-]+)$/` matches after the notice intercept and before the
whitelist check, following the same pending-holder pattern as notices:

1. It checks **shape only** (`[a-z0-9-]+`). On a match it stashes
   `pendingMiniAppLink.set({ id })` and returns `/(tabs)/home`.
2. The root layout's `PendingMiniAppLinkConsumer` is **where registry membership is
   checked**. It runs `GET /miniapps/:id` through `queryClient.fetchQuery`, opens the mini
   app shell over the home tab on success, and drops the link silently on failure, which is
   not a dead end because the user is already on home.

> [!NOTE]
> Why the membership check moved out of `+native-intent.tsx` and into the consumer: the
> registry became server-owned (`GET /miniapps`), which makes a **synchronous** lookup
> impossible, and keeping a bundled copy just to answer this one question would defeat the
> move to a server SSOT.
>
> `redirectSystemPath` can be async. Its expo-router type is `=> Promise<string> | string`
> and the result is awaited (`expo-router/build/link/linking.js`). The move was not about
> whether await is possible but about **what await costs here**. This function runs outside
> the React tree before the app mounts, so it (1) cannot share the `QueryClient` cache the
> shell reads, which means the same lookup twice, and (2) ties the entire first navigation
> to a network round trip, so an offline cold start draws nothing until axios times out. The
> consumer runs after mount and avoids both.
>
> Security is unchanged: an unknown slug still ends on `/(tabs)/home` and still cannot reach
> an arbitrary internal route. The only difference is that the redirect to home now happens
> **after** the intercept as a failed lookup, rather than **before** it.

## Blocked paths (examples)

| Path | Reason |
| --- | --- |
| `/webview?url=...` | Prevents loading an arbitrary URL |
| `/bus/realtime?groupId=...` | Internal screen |
| `/bus/schedule?groupId=...` | Internal screen |
| `/login`, `/onboarding` | Stops an untrusted deep link forcing entry into the auth or onboarding flow |
| `/sds-preview` | Development-only screen |

Blocked means a redirect to `/(tabs)/home`. This filtering applies the same way on a cold or
a warm start.

## Cold start vs Warm start

`redirectSystemPath` runs only when Expo Router handles an **external** deep link. Cold and
warm differ in the input shape and in where bare `/` goes, and nowhere else.

| Case | `initial` | Input shape | bare `/` goes to | Everything else |
| --- | --- | --- | --- | --- |
| Cold start, launched from a closed app | `true` | The raw launch URL, such as `skkuverse://notices/x/y` | `/(tabs)/<lastTab>`, a synchronous read of MMKV-persisted Zustand | **Same as warm** — the notice and mini app intercepts and the whitelist apply identically |
| Warm start, a deep link received while backgrounded | `false` | **The raw URL, same as cold** | `/(tabs)/home` | The notice and mini app intercepts and the whitelist |

> The input is the **full URL** in both cases. `expo-router` passes `{ path: initialUrl }`
> when cold and the `Linking` event's `{ path: url }` when warm. An earlier version of this
> table described the warm input as a parsed pathname, which was wrong, and it is also why
> `parseIncomingLink` is built to accept either shape.

- **Why bare `/` is special-cased.** Passing it through would let
  `<Redirect href="/(tabs)/home" />` in `app/index.tsx` leave a titleless entry in the root
  Stack history, which appears as a phantom item in the iOS long-press back menu. Routing
  directly avoids mounting the redirect-only screen at all. If one ever leaks through, the
  `<Stack.Screen name="index" options={{ title: t('nav.home') }}/>` fallback in
  `app/_layout.tsx` keeps the label from being blank.
- **Why filtering is uniform on cold start.** Letting cold start through would mean an
  untrusted deep link could reach an arbitrary internal route such as `/login` in a single
  launch. The whitelist comment in `+native-intent.tsx` states that intent.

### Navigation inside the app

`router.push()` and friends never reach `redirectSystemPath`, so the whitelist does not
affect them. There is one deliberate mirror: a bare `/` arriving through an SDUI 'route'
action is intercepted as `router.dismissTo('/(tabs)/home')` in
`apps/mobile/src/sdui/action-handler.ts`, avoiding the same titleless phantom.

## Path parsing (`parseIncomingLink`)

Expo's native-intent documentation says the `path` parameter is not guaranteed to be a path
or a valid URL. Both a raw launch URL and a bare pathname can arrive, so
`parseIncomingLink()` normalises either into `{ pathname, params }`.
`normalizeIncomingPath()` remains for callers that need only the pathname and delegates to
the same parser, because one parser means a fix cannot reach only one side.

### The authority fold: `skkuverse:` is a non-special scheme

In the WHATWG URL specification the special schemes are http, https, ws, wss, ftp and file,
and nothing else. `skkuverse:` is not among them, so the first segment after `//` parses as
**an authority rather than a path**:

```text
skkuverse://map?place=x   →  hostname "map",  pathname ""     ← the place query was lost too
skkuverse:///map?place=x  →  hostname "",     pathname "/map"
```

Both spellings mean the same route, so **for our scheme alone** the authority is folded back
in front of the path. While that fold was missing, `skkuverse://campus`, `//search`,
`//m/<slug>` and `//notices/<a>/<b>` all collapsed to `/` and went to home. In other words,
against what the tables above claimed to support, only the `/p/` universal links and the
triple-slash spelling actually worked.

Three things to watch when folding, all verified against the runtime implementation Expo
installs in place of the React Native shim, `whatwg-url-without-unicode`:

| Input | Parser result | Handling |
| --- | --- | --- |
| `skkuverse://MAP/HSSC` | hostname `"MAP"` | An opaque host is **not lowercased**. An uppercase link on a poster or QR code would miss the whitelist, so `.toLowerCase()` is applied **to the folded host segment only**. The path keeps its case, because a mini app slug is case-sensitive |
| `skkuverse://map:8080/x` | host `"map:8080"` | `host` includes the port, so use **`hostname`** |
| `skkuverse:map?place=x` | hostname `""`, pathname `"map"` | The slashless spelling, as Android intents produce. Needs a leading `/` added |

**Never fold `http(s)`.** There the host is a real domain, and `https://evil.com/map` has to
stay `/map`.

### Other normalisation

- Universal link: `https://skkuverse.com/p/notices/cse/5847` → `/p/notices/cse/5847` → strip
  `/p/` → `/notices/cse/5847`
- Empty authority with an empty pathname (`skkuverse://`) → `/`
- A relative form such as `/p/notices/x/y` is parsed against `skkuverse://app` as the base.
  The host `"app"` came from the base rather than from the link, so it is **not folded**,
  which is why parsing is two-stage: absolute first, base only on failure
- Non-ASCII paths are percent-encoded (`skkuverse://검색?q=1` → `/%EA%B2%80%EC%83%89`). <!-- conventions:allow-korean: the non-ASCII input is the example -->
  Planning to use a Korean path means matching `ALLOWED_PATHS` to the encoded form
- If constructing a `URL` throws, a manual fallback adds the leading `/`, drops `?` and `#`,
  and returns empty params

## Adding or changing an allowed path

Edit the `ALLOWED_PATHS` array in `apps/mobile/app/+native-intent.tsx`:

```ts
const ALLOWED_PATHS = ['/home', '/campus', '/transit', '/map/hssc', '/search'];
```

A tab path also goes in the `TAB_PATHS` mapping, so it is sent explicitly to the group path
`/(tabs)/<name>`:

```ts
const TAB_PATHS: Record<string, string> = {
  '/home': '/(tabs)/home',
  '/campus': '/(tabs)/campus',
  '/transit': '/(tabs)/transit',
};
```

A variable shape follows the anchored-pattern plus pending-holder approach, as
`NOTICE_PATH_RE` and `MINIAPP_PATH_RE` do.

## Testing

```bash
# Custom scheme, allowed. Test every one with a double slash: that is where the
# authority fold regresses.
xcrun simctl openurl booted "skkuverse://search"
xcrun simctl openurl booted "skkuverse://campus"
xcrun simctl openurl booted "skkuverse://transit"
xcrun simctl openurl booted "skkuverse://m/skkuw"
xcrun simctl openurl booted "skkuverse://notices/cse/5847"

# Map place: all three spellings have to reach the campus tab
xcrun simctl openurl booted "skkuverse://map?place=nsc-truck-01"
xcrun simctl openurl booted "skkuverse:///map?place=nsc-truck-01"
xcrun simctl openurl booted "skkuverse://MAP?place=nsc-truck-01"   # host lowercasing

# Must NOT be caught by the intercept: this goes to the SVG floor map
xcrun simctl openurl booted "skkuverse://map/hssc"

# Blocked, so home
xcrun simctl openurl booted "skkuverse://webview?url=https://evil.com"
xcrun simctl openurl booted "skkuverse://bus/realtime?groupId=1"
xcrun simctl openurl booted "skkuverse://map?place=../../etc"      # id shape check

# Universal links: only shared links may enter the app
xcrun simctl openurl booted "https://skkuverse.com/p/notices/cse/5847"  # app
xcrun simctl openurl booted "https://skkuverse.com/p/m/skkuw"           # app
xcrun simctl openurl booted "https://skkuverse.com/privacy"             # Safari
xcrun simctl openurl booted "https://skkuverse.com/p/search"            # Safari, once the AASA is tidied
```

> [!NOTE]
> **The simulator does enforce AASA.** `https://skkuverse.com/privacy` was confirmed to open
> in Safari rather than the app, so universal links can be tested there meaningfully.
> Whether a link enters the app or falls to Safari reflects the AASA list directly.
>
> Judge the result from the screen: `xcrun simctl io booted screenshot out.png`. The
> destination screens are visually distinct, so a hidden tab bar does not make them
> ambiguous.

### Regression traps

- **`/map/hssc`.** Without the `$` in `MAP_PATH_RE = /^\/map$/`, the `/map` intercept
  swallows the floor map. When it does, the result still looks like "the campus tab opened",
  so it does not read as a bug.
- **The double-slash spelling.** `skkuverse://<segment>` parses its first segment as an
  authority because the scheme is non-special. When that breaks, `//campus`, `//search`,
  `//m/<slug>` and `//notices/...` collapse to home **together**, silently. Testing only the
  triple-slash spelling misses it.
- **Notice detail.** Routing successfully and loading content are separate things. A
  nonexistent articleNo pushes the detail screen and then shows "the notice could not be
  loaded", which counts as routing having **passed**.

## Related

- [docs/README.md](../README.md) — the docs index and writing rules
- `apps/mobile/app/+native-intent.tsx` — the implementation SSOT for this contract. When the
  document and the code disagree, the code is right
- `packages/shared/src/utils/normalizeIncomingPath.ts` — path normalisation, with vitest
  tests alongside
