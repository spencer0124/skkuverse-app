---
title: Event Map Rendering
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-16
audience: internal
---

# Event Map Rendering

> How the app consumes the event map contract. It decides nothing: which layers exist, what is open,
> what a chip means all arrive as data. Ownership is
> [ADR 0004](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md);
> the server side is [`eventmap-api.md`](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/eventmap-api.md).

## 1. Summary

| | |
| --- | --- |
| Requests | `GET /eventmap/manifest` (poll) → `GET /eventmap/snapshot/:id/:version` (immutable) |
| New shared code | `packages/shared/src/eventmap/`: types, predicate, parser, hooks, store |
| New app code | `apps/mobile/src/features/eventmap/` |
| Touched | `CampusScreen`, `CampusNaverMap`, `MapMarkerLayer`, `FilterSheet`, `map/parser.ts`, `types/sdui.ts`, `features/search/store.ts`, `+native-intent.tsx` |
| Rendering | `<NaverMapMarkerOverlay>` children, with **no clustering** (§6) |

The app computes exactly three things, none of them a business rule: **predicate evaluation** (string
comparison against `item.tags`), **distance** (GPS is only on the device), and **status** (recomputed
against the device clock, §5).

The map renders **places**. It has no concept of an event, a booth, or a mini-app; those reach the
user only through the action union (§7).

## 2. Fetch path

Cold start is two requests. Every poll after that is one small request that usually returns **304**. The
snapshot carries structure and items together, so toggling a layer or chip costs **zero** network.

| Hook | Endpoint | staleTime | On failure |
| --- | --- | --- | --- |
| `useEventMapManifest` | `/eventmap/manifest` | `refreshAfterSec` from the payload | never throws → `activeLayerSetId: null` |
| `useEventMapSnapshot(url)` | the manifest's `snapshotUrl` | `Infinity` | fresh → MMKV last-known-good → `null` |

`staleTime: Infinity` is **correct, not a shortcut**: the URL is version-scoped, so a new version is a
new query key and there is nothing to revalidate.

**`nextChangeAt` scheduling.** Polling alone is not enough, because a night stall opening at 18:00 would
still read "준비중" until the next poll. <!-- conventions:allow-korean: the literal string the app shows --> `useEventMapManifest` also schedules a **one-shot timer** at
`nextChangeAt` that refetches and re-derives status. One timer, not a per-second tick; cleared on
unmount, re-armed on each manifest change. Guard a past/absent value (no timer) and clamp a distant
one — `setTimeout` overflows its 32-bit delay and fires immediately.

**Silent push** (`type: 'eventmap-refresh'`, data-only) invalidates the manifest query — the
emergency-correction lever, dropping worst-case propagation from ~135 s to ~0 s.

**A snapshot 404** means the version was TTL-reaped: invalidate the manifest and retry once, never
surface an error.

## 3. Tolerant parsing

The server fails loud on config it can fix. The client fails soft on a payload it can only render.
Every drop is counted and returned alongside the parsed snapshot so unknowns can be logged rather
than vanishing silently.

| Unknown | Enforced in | Behaviour |
| --- | --- | --- |
| any field | parser | ignored — schema is additive-only |
| `layer.render` | `eventmap/parser.ts` | drop the layer, warn once, count it |
| predicate node kind | `eventmap/predicate.ts` | **evaluates `false`** |
| `sort.by` | parser | drop that sort option |
| `icon.kind` | parser | coerce to `{symbol:'green'}` — the library's own default |
| `item.status` | parser | coerce to `unknown` |
| `chip.predicate` invalid | parser | drop the chip |
| card slot → missing field | `CardRenderer` | render nothing for that slot |
| `actionType` | `parseActionType` | `'unknown'`; `handleSduiAction` no-ops it |
| `schemaVersion` > app's | hook | ignore the snapshot; base map intact |

**Predicates fail closed.** A node returning `true` when unrecognized shows a booth a filter meant to
hide; returning `false` shows fewer things. Fewer is recoverable.

## 4. Predicate evaluator

`packages/shared/src/eventmap/predicate.ts` — pure, ~40 lines, closed node set:

```text
all | has | hasAny | hasAll | not | and | or | status
```

No arithmetic, no field access. A Mapbox-style expression language is a DSL that then needs
versioning of its own, and nothing in the product needs it.

### 4.1 Parity with the server

The evaluator only needs a twin if the **server** also evaluates predicates, which it does solely to
compute filter option counts — and counts are on the cut list. While they stay cut, this file lives
in the app alone and there is nothing to keep in sync.

If counts ever arrive, never hand-maintain a second fixture. Register
`predicate-vectors.json` through the fleet contract system, governed by
[umbrella ADR 0002 — pull-based config contracts](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0002-pull-based-config-contracts.md):

| Piece | Where |
| --- | --- |
| Origin | `skkuverse/contracts/predicate-vectors.json` |
| Registry | `skkuverse/contracts/manifest.json` |
| Local copy | vendored under `__tests__/`, hash-locked in `.contracts.lock.json` |
| Refresh | `python3 <skkuverse>/exported/sync_contracts.py pull --repo app` |

> The vendored copy is a **generated artifact**. Never hand-edit it, and never resolve a merge
> conflict in `.contracts.lock.json` by hand — take either side and re-run `pull`.

## 5. Status derivation

The snapshot is served `immutable, max-age=1y`, so it cannot also carry live status. It ships
`status` as of `materializedAt` plus the two instants, and the device re-derives. Implemented in
`packages/shared/src/eventmap/clock.ts`.

### 5.1 Skew comes from the manifest, never the snapshot

RFC 9111 §5.1: `Age` conveys time since the response was generated or validated **at the origin**,
and its presence means the response was not generated for this request — a cached response replays
the origin's original `Date`, unrefreshed. The snapshot is `immutable, max-age=31536000`, so iOS
`NSURLSession`'s default `URLCache` hands back yesterday's copy, `Date` and all. Measuring skew there
puts the offset ~24 h out, which either freezes every pin at its shipped status or draws yesterday's
map.

So only the **manifest** (`max-age=15`) feeds the clock, and `computeOffset` additionally refuses any
response carrying `Age > 0`, so a proxy cache in front of the manifest cannot poison it either.

### 5.2 Apply the offset; do not discard on it

```ts
// offset, measured ONCE per manifest response
const offset = computeOffset(serverDate, age, deviceNowAtFetch);   // 0 when unusable
const now = Date.now() + offset;

// per item, per render
if (item.startAt == null && item.endAt == null) return item.status;  // server says do not recompute
if (item.startAt != null && now < startAt)      return 'upcoming';
if (item.endAt   != null && now >= endAt)       return 'closed';     // half-open, matches the server
return 'open';
```

An earlier draft of this section discarded above an hour of skew and fell back to `item.status`. That
abandons exactly the device that needed help — the low-end Android three hours out is the one whose
derivation is wrong without correction, and freezing it is the same symptom the recompute exists to
prevent. There is no skew branch in derivation at all now; a threshold survives only inside
`computeOffset`, as a guard against a value too large to describe a device.

The offset is persisted and discarded after a week: the clock may have been corrected by NTP since,
which would make a stale offset *introduce* the error it exists to remove.

### 5.3 The next boundary is computed locally

`nextBoundaryAfter(items, now)` scans the snapshot for the earliest instant still ahead. The manifest
also carries `nextChangeAt` and is taken as a corroborating hint, but it cannot be the only source:
the dead-network festival is precisely the case where the manifest fetch fails, so arming off it
alone would mean a cached snapshot never flips status — and tracking status offline is the whole
reason the cache exists.

The timer delay is clamped to `2_147_483_647` ms. `setTimeout` stores it in a signed 32-bit int, so
anything past ~24.8 days overflows and fires immediately, turning a far-future boundary into a
refetch hot loop on festival day.

> Firing the timer must bump a counter that the status memo depends on, not merely invalidate the
> manifest query. An unchanged manifest returns byte-identical, React Query's structural sharing
> preserves object identity, nothing re-renders — and 18:00 passes with every pin still reading
> 준비중. <!-- conventions:allow-korean: the literal string the app shows -->

## 6. Rendering: pins, not clusters

Verified against the current release, not assumed: we run 2.7.0, latest is 2.9.0, and
`src/types/ClusterMarkerProp.ts` is **byte-identical** between them.

| | `NaverMapMarkerOverlay` | `ClusterMarkerProp` |
| --- | --- | --- |
| `caption` / `subCaption` | ✅ | ❌ |
| `alpha` (dim when closed) | ✅ icon together with caption | ❌ |
| per-marker `onTap` | ✅ | ❌ map-level `onTapClusterLeaf` |
| `anchor`, `tintColor`, `minZoom`/`maxZoom` | ✅ | ❌ |
| `zIndex` / `globalZIndex`, children | ✅ | ❌ |

A cluster leaf accepts only `identifier`, `latitude`, `longitude`, `image`, `width`, `height`. It
would erase booth **names** — the primary affordance at a festival — and make dim-when-closed
inexpressible. The existing building layer already draws 100+ overlay markers on this same screen.

Upstream is `mym0404/react-native-naver-map` and this is unlikely to change: issue **#23** was opened
by the maintainer in 2024 promising these options and was stale-bot closed undelivered; PR **#139**
(cluster image + leaf caption) has been open and stalled on CI since 2025-09-24; issue **#22** (iOS
`screenDistance` broken) was stale-closed with no fix.

- There is **no cluster-teardown flicker to design around.** Chip toggles touch React children only.
  (`clusters` is keyed by a hash of the whole marker array, and **both** platforms wipe every
  clusterer when it changes — iOS `RNCNaverMapView.mm:234-245`, Android `RNCNaverMapViewManager.kt:547-556`.)
- The `updateLeafMarker` marker-reuse warning in Naver's native docs is an **Android SDK concern that
  does not apply** at the RN declarative layer.
- `render: 'pin' | 'cluster' | 'list'` stays in the wire contract, so switching later is a server edit.

### 6.1 Density levers, in order

1. `isHideCollidedCaptions` — already used by the `textLabel` branch of `MapMarkerLayer`
2. Per-layer `minZoom` / `maxZoom`, server-supplied
3. **`stackKey`**

### 6.2 `stackKey`

Same plot, two occupants (a daytime booth and a night stall) means two items at identical coordinates.

The server emits `stackKey` and `pinPriority`. The client renders **at most one marker per
`stackKey`**, keeping the highest priority (ties broken by status rank
`open > upcoming > closed > unknown`); a tap opens a peek sheet listing every item sharing the key.

Generic on purpose: `stackKey` is a string the server chooses. Normally `placeId`; if the main field is too
dense the server switches it to `zone`. **No data change, no app release.**

### 6.3 `EventMapPinLayer`

One `<NaverMapMarkerOverlay>` per deduped `stackKey`:

| Prop | Value |
| --- | --- |
| `image` | resolved from `icons` **by `kind`** — see below |
| `caption` | title, with `isHideCollidedCaptions` |
| `alpha` | `status === 'closed' ? 0.45 : 1` — applies to icon together with caption |
| `minZoom` / `maxZoom` | from the layer |
| `onTap` | `selectStack(stackKey)` |
| children | **none** — sidesteps the Android bitmap-snapshot race in [`android-naver-map-markers.md`](android-naver-map-markers.md) |

Icon resolution is by `kind`, in `apps/mobile/src/features/eventmap/icon.ts`:

| `IconSpec` | → |
| --- | --- |
| `{kind:'symbol', symbol}` | `{symbol}` when the value is in the SDK's `MarkerSymbol` union |
| `{kind:'remote', uri, width, height}` | `{httpUri: uri}` **plus** width/height — without them the SDK sizes from the downloaded bitmap, which differs between debug and release |
| unknown id, unknown kind, symbol outside the union | `{symbol:'green'}` |

An `{httpUri}`-only reading of this table would land every ESKARA pin on the green fallback: the live
config ships **symbol icons exclusively**, and colour is the entire visual differentiation — bar red,
booth blue, food yellow, stage pink, facility lightblue, every `*_off` gray. The allowlist lives in
the app rather than `packages/shared` because `MarkerSymbol` is the SDK's union and shared must not
depend on the SDK; the wire type is an open string, so the check belongs on the app side of that seam.

`item.iconIdClosed` swaps in **alongside** the `alpha` dimming, not instead of it: the closed icon
carries the meaning, the alpha carries the emphasis, and either alone reads as a rendering glitch.

## 7. Actions and the map scheme

### 7.1 The action union

A sheet button carries one action. The app renders it; it never interprets what the action *means*.

| `actionType` | Handling | Status |
| --- | --- | --- |
| `content` | Render inline in the sheet, no navigation | **new** |
| `route` | `router.push(actionValue)`; a bare `/` is intercepted as `router.dismissTo('/(tabs)/home')` | exists |
| `webview` | `openWebView({url, title})` → `router.push('/webview', {url, title})` | exists — **ESKARA's primary type** |
| `external` | The **same** in-app `/webview` shell; a non-web scheme (`mailto:`, `tel:`) hands off to `Linking.openURL` | exists |
| `miniapp` | Mini-app scheme | **deferred**, §7.3 |

`webview` and `external` are one code path in `handleSduiAction`, and `webviewColor` is accepted
but never read. They stay distinct action types because the server still emits both and older
clients treat them differently; on this side the only difference is whether a title came along.
What a loaded page may do is decided by its origin, not by the verb that opened it — so the
`external` row is not a weaker security posture, it is the same gate reached by a second name.

Three of the five predated Phase 3 in `packages/shared/src/types/sdui.ts`; the work was `content`
plus the parser cleanup, and all of it has shipped. `parseActionType` returns `'unknown'` for
unrecognized values, `handleSduiAction` no-ops it, and both `renderer.tsx` and the action handler
now carry a `never` exhaustiveness guard.

> `webview` is the **primary** type for ESKARA, which makes the origin gate in `app/webview.tsx` a
> hard dependency rather than a mini-app concern. That gate is in place: `handleMessage` re-resolves
> `resolveWebviewCapabilities(event.nativeEvent.url, getBridgeOrigins())` **per message**, against
> the document that actually posted it rather than once at open time.

`content` is handled by the sheet that renders the button, not by `handleSduiAction` — that
dispatcher is fire-and-forget and has no surface to render prose into. `miniapp` and `unknown` render
no button at all: the parser keeps them for contract fidelity, but a button that does nothing is
worse than a missing one.

**The peek sheet dismisses itself before it navigates.** `ActionButton` calls
`useBottomSheetModal().dismiss()` and only then `handleSduiAction`. This is not polish; without it
the destination arrives damaged.

A `BottomSheetModal` does not live in the screen that rendered it. `@gorhom/portal` mounts the host
as a sibling that **follows** `children` inside `BottomSheetModalProvider`, and that provider wraps
the root `<Stack>` in `app/_layout.tsx`. The sheet is therefore outside the navigator and painted
after it, so a pushed `/webview` slides in **underneath** and lands with its lower half covered.
Nothing on the pushing side can correct that; the sheet has to go first.

The same constraint is why `BuildingDetailSheet` dismisses before pushing `/map/hssc`, and why
`NoticeDetailScreen`'s original-notice link hands off to the system browser rather than pushing.

Dismissing rather than minimising-and-restoring is also the behaviour wanted here: `onDismiss`
clears `selectedStackKey` (§8), so backing out of the web view lands on the plain campus map instead
of a sheet the user already navigated away from. It pairs with `stackBehavior="replace"`, which
stops the default `'switch'` from resurrecting `BuildingDetailSheet` underneath.

### 7.2 Universal map scheme

```text
skkuverse://map?place=<placeId>
```

Independent of any consumer. A booth and a building are addressed identically, because both are
places. It needed almost no new machinery — the search→map handoff already did this work, so a deep
link became a **second producer** for the same store (`useMapNavStore`, in `features/search/store.ts`).

`MapNavPayload` is discriminated because the two producers know different things:

```ts
export type MapNavPayload =
  | { kind: 'building'; skkuId: number; lat: number; lng: number; campus?: Campus;
      highlightFloor?: string; highlightSpaceCd?: string }
  // A deep link carries only an id — coordinates are resolved from the snapshot.
  | { kind: 'place'; placeId: string };
```

`campus` is **optional**, and that is load-bearing: a space search result genuinely has none, and the
map must then leave the campus alone rather than guess and jump the user to the wrong one.

`+native-intent.tsx` **intercepts** `/map`, and deliberately does not add it to `ALLOWED_PATHS` —
that would leave a second, unreachable path through the same function, which is why notices and
mini-apps have no whitelist entry either. `MAP_PATH_RE` ends at `/map`, so **`/map/hssc` keeps
falling through to the webview SVG floor map.** The `place` id is shape-checked but not looked up:
this runs outside the React tree, so a lookup would be a duplicate request blocking the app's first
navigation.

> A `{kind:'place'}` payload has no coordinates, and a cold-start deep link routinely beats the
> snapshot. `CampusScreen` resolves `placeId` → stack only **after** `isSettled`, and abandons after
> 20 s — offline with no cache, settled may never arrive, and a late fire would yank the camera
> minutes after the user moved on. An unresolvable id lands on the campus tab with no sheet, which is
> also the permanent behaviour for an id matching nothing, never an error.

No new screen: `skkuverse://map?place=X` resolves to `/(tabs)/campus` plus a pending payload. Details
and the full route table: [`../reference/deep-link.md`](../reference/deep-link.md).

### 7.3 Deferred — the `miniapp` action

Kept in the union so the contract does not change later, but not emitted until the mini-app platform
ships. When it does:

- Widen `MINIAPP_PATH_RE` to carry a sub-path, **keeping the anchors**
- Resolve the sub-path against the registry `startUrl`, **failing closed on origin**:

  ```ts
  const resolved = new URL(path, base);
  // new URL('//evil.com/x', 'https://a.com') → 'https://evil.com/x'.
  // Without this a deep link escapes the registered origin and renders arbitrary
  // content inside a shell that shows the verified badge.
  return resolved.origin === base.origin ? resolved.toString() : startUrl;
  ```

- The native side validates the *origin*, never the path — the page list is a mini-app-owned contract

Switching ESKARA buttons from `webview` to `miniapp` is then a server payload change with no app
release.

## 8. State

A new `useEventMapStore` (Zustand):

```ts
{ activeLayerSetId, layerVisibility, selectedChips: Record<groupId, string[]>,
  sortId, selectedStackKey, clockOffset }
```

Persisted: everything except `selectedStackKey` — a peek sheet reopening on cold start, for a booth
tapped yesterday, is never right.

`initFromSnapshot` seeds defaults for **unknown ids only**, mirroring `initFromConfig` so user toggles
survive a refetch — except when `activeLayerSetId` changes, which means a different event entirely and
starts clean. That reset is what bounds the persisted blob to one event's worth of keys.

**`useMapLayerStore` is left untouched** — two stores, two lifetimes. Coupling per-event state into
the permanent campus-layer store would leave dead `eskara-2026` keys in persisted state forever.

### 8.1 `basemapOverride` is derived, never persisted

The snapshot names base-map layers the event forces to a visibility — normally hiding building
numbers while leaving building names up, so pins stay legible without stripping the map of
orientation. Those are two
separate layers in `/map/config` (`building_numbers`, `building_labels`), so this needs no new concept.

It is applied as an overlay at render time:

```ts
const visible = basemapOverride[id] ?? userToggle[id] ?? layer.defaultVisible;
```

and deliberately kept out of the store. A force-then-restore design loses the user's real
toggle whenever the restore does not run — app killed, activation flipped between the write and the
restore — leaving a layer off permanently with nothing on screen to explain why. Derived, the override
simply stops existing when the event does, and no restore code is needed. Same reasoning that put
event state in its own store, one level down.

## 9. Where the code lives

Shipped in Phase 3 ([skkuverse#15](https://github.com/spencer0124/skkuverse/issues/15)):

| File | What |
| --- | --- |
| `packages/shared/src/types/eventmap.ts` | wire types, mirrored from the server with a name-mapping table in the header |
| `packages/shared/src/eventmap/clock.ts` | offset, status derivation, `nextBoundaryAfter` (§5) |
| `packages/shared/src/eventmap/predicate.ts` | `evaluatePredicate` + `isValidPredicate` (§4) |
| `packages/shared/src/eventmap/parser.ts` | tolerant parse → `{ snapshot, dropped }` (§3) |
| `packages/shared/src/eventmap/derive.ts` | status re-derivation, stack building, visible-stack selection (§6.2) |
| `packages/shared/src/eventmap/{repository,useEventMap}.ts` | fetch, MMKV last-known-good, hooks (§2) |
| `packages/shared/src/store/eventmap.ts` | client state (§8) |
| `packages/shared/src/api/safe-request.ts` | `safeGetTimed` — the only reader of `Date`/`Age` |
| `apps/mobile/src/features/eventmap/icon.ts` | `IconSpec` → SDK image prop (§6.3) |
| `apps/mobile/src/features/eventmap/EventMapPinLayer.tsx` | one marker per stack |
| `apps/mobile/src/features/eventmap/EventMapPeekSheet.tsx` | stacked-place sheet + action buttons |
| `apps/mobile/src/lib/pending-map-place-link.ts` | deferred deep-link intent (§7.2) |
| `apps/mobile/src/features/map/CampusScreen.tsx` | mounts the pin layer as a sibling; applies `basemapOverride`; resolves place links |

Fixed on the way through: the map parser's unchecked union casts and silent `(0,0)` coordinates,
`parseActionType`'s unknown → `'external'`, the stale offline `DEFAULT_MAP_CONFIG`, hardcoded caption
colours, and the custom-scheme authority defect that had silently broken every
`skkuverse://<segment>` link.

`CampusNaverMap` needed **no change** — it already forwards `children` verbatim into `NaverMapView`,
and Phase 3 needs no new map-level prop.

Still Phase 6 ([#18](https://github.com/spencer0124/skkuverse/issues/18)): `EventMapChipRow`,
`EventMapList`, `CardRenderer` (swapping out this sheet's `ItemBody`), sorts, and giving the dead
`FilterSheet` / `FilterButton` an entry point.

## 10. Gotchas

- **Coordinate order.** The wire carries named `lat`/`lng` and no positional tuples, because
  `PolylineCoord` is `[lat, lng]` while Mongo/GeoJSON is `[lng, lat]`. Swapped Seoul coordinates land
  in the ocean and **never throw**. Do not introduce a positional pair here.
- **zh.** `MapMarkerLayer` picks text with `lang === 'en' ? en : ko`, so **zh silently falls back to
  ko** on the existing marker path. Event text is resolved server-side to flat strings, so event pins
  get correct zh for free.
- **`parseActionType` unknown → `'unknown'` is live for ALL SDUI**, not only the event map. A section
  with a typo'd `actionType` used to be handed to the webview opener and now does nothing. That is
  the intended direction — the failure mode of not understanding an action should not be to open it —
  but it reads as a regression in QA unless you know.
- **`expo-location` is not a dependency.** Distance sort requires adding it — a native module, so a
  fresh dev-client build. If permission is denied, **hide** the sort rather than showing a dead control.
- **Do not bump `@mj-studio/react-native-naver-map`.** 2.9.0 changes nothing about clustering and
  bumps the native Naver SDK, so it needs `expo prebuild --clean` plus a manual `runtimeVersion` bump.
  Separately, `patches/@mj-studio+react-native-naver-map+2.7.0.patch` is now redundant — PR #184
  (ours) shipped upstream in v2.7.1 with a better fix.
- **`useMapConfig` must keep its never-throw fallback.** The event map is a separate request precisely
  so a map-config hiccup cannot take it down, and vice versa.

## 11. Related

- [ADR 0004 — event map layer ownership](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md)
- [Server API reference](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/eventmap-api.md)
- [Implementation plan — skkuverse#11](https://github.com/spencer0124/skkuverse/issues/11)
- [Android Naver map markers](android-naver-map-markers.md) — the bitmap-snapshot race the pin layer avoids
- [App ADR 0006 — mini-app webview & push architecture](../decisions/0006-miniapp-webview-push-architecture.md)
- [App ADR 0002 — no notification inbox](../decisions/0002-no-notification-inbox.md) — amended by the event map inbox. *(Distinct from umbrella ADR 0002, pull-based config contracts, cited in §4.1.)*
