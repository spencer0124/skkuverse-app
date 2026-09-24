---
title: Add a View-on-Map Button to a Web Page
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-24
audience: internal
---

# Add a View-on-Map Button to a Web Page

> How to give a first-party web page (a mini app, or a page in `/webview`) a button that closes the page and opens the app's campus map on one place, with its sheet up. Read this before wiring a new button, or when an existing one does nothing.

> [!NOTE]
> This crosses **two repositories**. The page lives in the web repo (the ESKARA site is
> `spencer0124/miniapp-eskara`), and the place it points at lives in skkuverse-server. The
> app needs no change for a new button — only for a new *kind* of action, which is a
> security decision covered at the end.

## Overview

A page asks for an action over the bridge, and the app performs it only if every check passes:

```text
page ── web:action { actionType: 'map', actionValue: 'event:<placeId>' } ──▶ app shell
          │
          ├─ 1. origin gate        resolveWebviewCapabilities  (server's bridgeOrigins, per message)
          ├─ 2. payload shape      parseWebMessage             (both fields non-empty strings)
          ├─ 3. page allowlist     resolveWebAction            (map, miniapp — nothing else)
          └─ 4. value grammar      parseMapPlaceRef            ([<kind>:]<placeId>, anchored)
                     │
                     ▼
          handleSduiAction → openMapAtPlace → pendingMapPlaceLink → CampusScreen opens the sheet
```

| Piece | Where |
| --- | --- |
| Message union (cross-repo contract) | `packages/bridge/src/types.ts` |
| Page allowlist and feature-detection script | `packages/shared/src/app/web-action.ts` |
| Place reference grammar, shared with `skkuverse://map?place=` | `packages/shared/src/map/place-ref.ts` |
| Handlers in both shells | `app/webview.tsx`, `app/mini-app.tsx` → `features/webview/web-action.ts` |
| Closing the shell and handing the place to the map | `src/lib/open-map-place.ts` |
| The why, and the list of what a page may ask for | [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md) §9 |

The value is the **same string** as the deep link's `?place=`, so any reference you can open with
`skkuverse://map?place=<ref>` works in a button, and the other way round.

## Prerequisites

- **The page's origin is in the server's `BRIDGE_ORIGINS`** (`skkuverse-server/src/infra/origins.ts`).
  A page on any other origin is refused at step 1, silently. `webview.skkuverse.com` and
  `eskara.miniapp.skkuverse.com` are in it today. Adding one is a trust decision, not a config
  change: it hands the page `Linking.openURL` as well.
- **The place exists on the map.** An event place is a row in
  `skkuverse-server/scripts/data/<layerSetId>-places.json`, imported with `npm run eventmap:import`.
  A building needs nothing: every campus building is already a place.
- **The installed app advertises `map`.** Both shells inject `window.skkuverse.bridge.actions` before
  content loads. Builds made before `web:action` inject nothing, which is what keeps the button
  hidden there instead of dead.

## Steps

### 1. Find the place reference

| Place | Reference | Where the id comes from |
| --- | --- | --- |
| Event place (booth, zone) | `event:<layerSetId>-<id>` | The sheet's `id`, prefixed with the layer set. The wristband booth `wristband-guest` in `eskara-2026` is `event:eskara-2026-wristband-guest` |
| Campus building | `skku_building:<skkuId>` | The building number |

Confirm an event place against what the server actually serves:

```bash
curl -s https://api.skkuverse.com/map/overlays/event \
  | jq -r '.. | objects | select(has("tap")) | .tap | select(.) | "\(.kind):\(.placeId)"' \
  | grep wristband
```

Then prove the reference on a simulator **before** touching the page. The deep link runs the
same grammar and the same resolver as the button:

```bash
xcrun simctl openurl booted "skkuverse://map?place=event:eskara-2026-wristband-guest"
```

The campus tab should open with that place's sheet up. If it does not, fix the reference first;
see [Troubleshooting](#troubleshooting).

### 2. Add the button to the page

On the ESKARA site, the component already exists. Put the reference in the page's data file
next to the copy, and render `MapButton`:

```ts
// apps/webview/src/pages/eskara/data/<page>.ts
export const MAP_PLACES = {
  outsider: 'event:eskara-2026-wristband-guest',
} as const;
export const MAP_BUTTON_LABEL = '지도에서 보기'; // conventions:allow-korean: shipped button copy
```

```tsx
// apps/webview/src/pages/eskara/<Page>.tsx
<MapButton place={MAP_PLACES.outsider}>{MAP_BUTTON_LABEL}</MapButton>
```

`MapButton` (`apps/webview/src/components/eskara.tsx`) renders nothing unless the host lists `map`,
so a plain browser and an old app build show no button at all. The wristband page
(`pages/eskara/Wristband.tsx`) is the worked example, with one button per booth.

On a site without that component, copy the message union from this repo's
`packages/bridge/src/types.ts` **byte for byte**, then add the two helpers:

```ts
export function canOpenMap(): boolean {
  return window.skkuverse?.bridge?.actions?.includes('map') === true;
}

export function openMapPlace(place: string): void {
  postToApp({ type: 'web:action', actionType: 'map', actionValue: place });
}
```

Gate the button on `canOpenMap()`. Never on the user agent, and never on
`window.ReactNativeWebView` alone: that says the page is in *an* app, not that the app can open
the map.

### 3. Verify on the simulator

Use a Debug build connected to Metro. The mini app loads the **deployed** site, so the page change
has to be live first. A change is live when the new asset carries it:

```bash
js=$(curl -s https://eskara.miniapp.skkuverse.com/eskara/wristband | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://eskara.miniapp.skkuverse.com$js" | grep -c 'web:action'
```

Then:

1. `xcrun simctl openurl booted "skkuverse://m/eskara-2026/eskara/wristband"` opens the page in the
   mini app shell. Restart the app first if Metro did not reload it.
2. The button shows. Tap it: the shell closes, and the map opens on the place with its sheet up.
3. **The round trip:** map → a place's sheet → a `miniapp` button into the page → a button for a
   *different* place. The new place's sheet must open, not the one you left from.
4. Open the same URL in Safari. No button.

### 4. Deploy the page

The ESKARA site deploys on merge to `main` (Cloudflare Pages, no CI): commit on `dev`, open a PR to
`main`, merge. `pnpm typecheck && pnpm build` in `eskara/` first, since nothing else runs them.

The page can deploy before the app does. Until the app update reaches a device, that device
advertises nothing, and the button stays hidden.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| No button in the app | The installed build predates `web:action`, so `window.skkuverse` is absent | Expected until the update ships. Check with a Debug build |
| No button in any build | The page gates on something else, or reads `window.skkuverse` before it exists | Gate on `canOpenMap()` at render time; the script runs before content loads |
| Button shows, tap does nothing | The page's origin is not in `bridgeOrigins` (step 1), or the value fails the grammar (step 4) | Dev builds log `[webview] web:action refused: <type> <value>`. Check the origin against `GET /app/config` → `webview.bridgeOrigins` |
| Map opens, no sheet | The id matches no place, the markers had not settled within 20 s, or the festival gate is shut (store builds see no event places) | Re-run step 1's `curl` and deep link. The gate is `features/map/festivalGate.ts` |
| Map opens on the wrong campus, or a stale sheet | Should not happen: an explicit place cancels the round-trip restore | Report it. The cancel is in `CampusScreen`'s pending-place consumer |
| The web shell stays open under the map | Someone used `web:open-url` with `skkuverse://map?…` instead of `web:action` | Use `openMapPlace`. A self-deep-link stacks a second copy of the tabs rather than replacing the shell |

## Adding a different kind of page action

A page can ask for `map` and `miniapp`, and nothing else. That list is a **security boundary**, not a
feature list: a page is anything its host ever serves, so it gets less than a server-authored
button does.

- **Never add `route`, `webview` or `external`.** Each names a destination rather than a thing:
  `route` reaches every registered screen (debug screens and `/webview?url=<anything>` included),
  and the other two open any URL. That is the hole `web:navigate` was removed for.
- A new kind must take an **id the app resolves itself**, checked by an anchored grammar, the way
  `map` takes a place reference and `miniapp` takes a mini-app target.
- The change is three places at once: `WEB_ACTION_TYPES` and `resolveWebAction` in
  `packages/shared/src/app/web-action.ts`, a refusal case for every malformed value in
  `packages/shared/src/app/__tests__/web-action.test.ts`, and the table in ADR 0006 §9.

## Related

- [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md) §9: the bridge gate, and what a page may ask for
- [eventmap-rendering.md](../explanation/eventmap-rendering.md) §7.1–7.3: the action union, the map scheme, mini-app targets
- [deep-link.md](../reference/deep-link.md): `skkuverse://map?place=`, the same grammar
- [packages/bridge/README.md](../../packages/bridge/README.md): the message contract
