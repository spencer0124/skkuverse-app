# Event Map Rendering

> How the app consumes the event map contract. It decides nothing — which layers exist, what is open,
> what a chip means all arrive as data. Ownership is
> [ADR 0004](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md);
> the server side is [`eventmap-api.md`](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/eventmap-api.md).

## 1. Summary

| | |
| --- | --- |
| Requests | `GET /eventmap/manifest` (poll) → `GET /eventmap/snapshot/:id/:version` (immutable) |
| New shared code | `packages/shared/src/eventmap/` — types, predicate, parser, hooks, store |
| New app code | `apps/mobile/src/features/eventmap/` |
| Touched | `CampusScreen`, `CampusNaverMap`, `MapMarkerLayer`, `FilterSheet`, `map/parser.ts`, `types/sdui.ts`, `features/search/store.ts`, `+native-intent.tsx` |
| Rendering | `<NaverMapMarkerOverlay>` children — **no clustering** (§6) |

The app computes exactly three things, none of them a business rule: **predicate evaluation** (string
comparison against `item.tags`), **distance** (GPS is only on the device), and **status** (recomputed
against the device clock, §5).

The map renders **places**. It has no concept of an event, a booth, or a mini-app — those reach the
user only through the action union (§7).

## 2. Fetch path

Cold start is two requests; every poll after is one small request that usually returns **304**. The
snapshot carries structure and items together, so toggling a layer or chip costs **zero** network.

| Hook | Endpoint | staleTime | On failure |
| --- | --- | --- | --- |
| `useEventMapManifest` | `/eventmap/manifest` | `refreshAfterSec` from the payload | never throws → `activeLayerSetId: null` |
| `useEventMapSnapshot(url)` | the manifest's `snapshotUrl` | `Infinity` | fresh → MMKV last-known-good → `null` |

`staleTime: Infinity` is **correct, not a shortcut**: the URL is version-scoped, so a new version is a
new query key and there is nothing to revalidate.

**`nextChangeAt` scheduling.** Polling alone is not enough — a 주점 opening at 18:00 would read
"준비중" until the next poll. `useEventMapManifest` also schedules a **one-shot timer** at
`nextChangeAt` that refetches and re-derives status. One timer, not a per-second tick; cleared on
unmount, re-armed on each manifest change. Guard a past/absent value (no timer) and clamp a distant
one — `setTimeout` overflows its 32-bit delay and fires immediately.

**Silent push** (`type: 'eventmap-refresh'`, data-only) invalidates the manifest query — the
emergency-correction lever, dropping worst-case propagation from ~135 s to ~0 s.

**A snapshot 404** means the version was TTL-reaped: invalidate the manifest and retry once, never
surface an error.

## 3. Tolerant parsing

The server fails loud on config it can fix; the client fails soft on a payload it can only render.
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

If counts ever ship, do **not** hand-maintain a second fixture. Register
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

The snapshot is served `immutable, max-age=1y`, so it cannot also carry live status.

```ts
const skew = Math.abs(deviceNow - serverDateAtFetch);
if (skew > 60 * 60 * 1000)                       return item.status;   // broken clock
if (item.startAt == null && item.endAt == null)  return item.status;
return deriveStatus(item.startAt, item.endAt, deviceNow);
```

`serverDateAtFetch` is the `Date` response header captured when the snapshot was fetched.

## 6. Rendering: pins, not clusters

Verified against the current release, not assumed: we run 2.7.0, latest is 2.9.0, and
`src/types/ClusterMarkerProp.ts` is **byte-identical** between them.

| | `NaverMapMarkerOverlay` | `ClusterMarkerProp` |
| --- | --- | --- |
| `caption` / `subCaption` | ✅ | ❌ |
| `alpha` (dim when closed) | ✅ icon *and* caption | ❌ |
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

Same plot, two occupants (day booth + night 주점) = two items at identical coordinates.

The server emits `stackKey` and `pinPriority`. The client renders **at most one marker per
`stackKey`**, keeping the highest priority (ties broken by status rank
`open > upcoming > closed > unknown`); a tap opens a peek sheet listing every item sharing the key.

Generic on purpose: `stackKey` is a string the server chooses. Normally `placeId`; if 대운동장 is too
dense the server switches it to `zone`. **No data change, no app release.**

### 6.3 `EventMapPinLayer`

One `<NaverMapMarkerOverlay>` per deduped `stackKey`:

| Prop | Value |
| --- | --- |
| `image` | `{httpUri}` from the snapshot's `icons` dict; bundled fallback; unknown id → `{symbol:'green'}` |
| `caption` | title, with `isHideCollidedCaptions` |
| `alpha` | `status === 'closed' ? 0.45 : 1` — applies to icon *and* caption |
| `minZoom` / `maxZoom` | from the layer |
| `onTap` | `selectStack(stackKey)` |
| children | **none** — sidesteps the Android bitmap-snapshot race in [`android-naver-map-markers.md`](android-naver-map-markers.md) |

## 7. Actions and the map scheme

### 7.1 The action union

A sheet button carries one action. The app renders it; it never interprets what the action *means*.

| `actionType` | Handling | Status |
| --- | --- | --- |
| `content` | Render inline in the sheet, no navigation | **new** |
| `route` | `router.push(actionValue)` | exists |
| `webview` | `router.push('/webview', {url, title, color})` | exists — **ESKARA's primary type** |
| `external` | `WebBrowser.openBrowserAsync(actionValue)` | exists |
| `miniapp` | Mini-app scheme | **deferred**, §7.3 |

Three of five already exist in `packages/shared/src/types/sdui.ts`, so the work is `content` plus the
parser cleanup: `parseActionType` returns `'unknown'` for unrecognized values, `handleSduiAction`
no-ops it, and a `never` exhaustiveness guard is added (`renderer.tsx` has one; the action handler
does not).

> `webview` is the **primary** type for ESKARA, which makes the origin gate in `app/webview.tsx` a
> hard dependency rather than a mini-app concern. On `dev` that file has no gate at all — it runs
> `Linking.openURL` unconditionally. The gate arrives with the `integrate/app-backlog` merge.

### 7.2 Universal map scheme

```text
skkuverse://map?place=<placeId>
```

Independent of any consumer. A booth and a building are addressed identically, because both are
places. Almost no new machinery is needed — the search→map handoff already does this work:

`features/search/store.ts` holds a `pendingNavPayload`, and `CampusScreen.tsx:148-177` consumes it by
switching campus, animating the camera to 17.5, then presenting the sheet once it settles. A deep
link is a **second producer** for that store.

- Widen `BuildingNavPayload` (`packages/shared/src/types/building.ts:141`) into a discriminated
  `MapNavPayload`:

  ```ts
  export type MapNavPayload =
    | { kind: 'building'; skkuId: number; lat: number; lng: number; campus: Campus;
        highlightFloor?: string; highlightSpaceCd?: string }
    // A deep link carries only an id — coordinates are resolved from the snapshot.
    | { kind: 'place'; placeId: string };
  ```

  `campus` is `string` today; align it to the `Campus` union while touching this.
- Rename `useSearchResultStore` → `useMapNavStore`. Its docblock already describes a generic
  mechanism; only the name is producer-specific.
- `+native-intent.tsx`: whitelist bare `/map` and stash the payload, as the notice intercept does.
  **`/map/hssc` must keep routing to the webview SVG floor map.**

> A `{kind:'place'}` payload has no coordinates, and a cold-start deep link can arrive before the
> snapshot is fetched. `CampusScreen` must resolve `placeId` → item **after** the snapshot lands. An
> unresolvable id lands on the campus tab with no sheet — never an error.

No new screen: `skkuverse://map?place=X` resolves to `/(tabs)/campus` plus a pending payload.

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

A new `useEventMapStore` (Zustand), persisting **layer visibility only**:

```ts
{ activeLayerSetId, layerVisibility, selectedChips: Record<groupId, string[]>,
  filterSelections, sortId, selectedStackKey }
```

`initFromSnapshot` seeds defaults for **unknown ids only**, mirroring `initFromConfig` so user
toggles survive a refetch.

**`useMapLayerStore` is left untouched** — two stores, two lifetimes. Coupling per-event state into
the permanent campus-layer store would leave dead `eskara-2026` keys in persisted state forever.

`basemapOverride` must **force** visibility, not default: `initFromConfig` deliberately preserves user
toggles and will not hide a building layer the user turned on.

## 9. Files touched

| File | Change |
| --- | --- |
| `features/eventmap/*` | **new** — `EventMapPinLayer`, `EventMapChipRow`, `EventMapList`, `CardRenderer`, `EventMapPeekSheet`, `useVisibleItems` |
| `packages/shared/src/eventmap/*` | **new** — types, `predicate.ts`, `parser.ts`, `useEventMap.ts`, store |
| `features/search/store.ts` | rename → `useMapNavStore`; payload becomes `MapNavPayload` |
| `packages/shared/src/types/building.ts` | `BuildingNavPayload` → discriminated `MapNavPayload`; `campus` → `Campus` |
| `app/+native-intent.tsx` | whitelist bare `/map`, stash the place payload; leave `/map/hssc` alone |
| `features/map/CampusScreen.tsx` | pin layer as a sibling of existing layer children; chip row into the floating `controlRow`; wire `FilterButton` + `filterSheetRef.present()`; resolve `{kind:'place'}` after the snapshot lands |
| `features/map/components/CampusNaverMap.tsx` | forwards a fixed prop set — new map-level props need a passthrough |
| `features/map/components/MapMarkerLayer.tsx` | caption `color` is hardcoded (`'black'` / `'#333333'`); read from `layer.style?.color` |
| `features/map/components/FilterSheet.tsx` | extend with event filter groups + sort, keeping campus/base-layer pills |
| `packages/shared/src/map/parser.ts` | allowlist replaces both `as`-casts; drop items whose coordinates are not finite |
| `packages/shared/src/map/defaults.ts` | repoint `campus_buildings` to `/map/markers/campus?overlay=number` |
| `packages/shared/src/types/sdui.ts` | add `content`; `parseActionType` unknown → `'unknown'` |
| `sdui/action-handler.ts` | `case 'content'`, `case 'unknown'`, `never` exhaustiveness guard |
| `services/notification-router.ts` | notification taps resolve as **actions**, defaulting to the ESKARA inbox page |

**`FilterSheet` and `FilterButton` are currently dead code** — the sheet is rendered but `.present()`
is never called and the button is imported nowhere. This work gives them an entry point.

## 10. Gotchas

- **Coordinate order.** The wire carries named `lat`/`lng` and no positional tuples, because
  `PolylineCoord` is `[lat, lng]` while Mongo/GeoJSON is `[lng, lat]`. Swapped Seoul coordinates land
  in the ocean and **never throw**. Do not introduce a positional pair here.
- **zh.** `MapMarkerLayer` picks text with `lang === 'en' ? en : ko`, so **zh silently falls back to
  ko** on the existing marker path. Event text is resolved server-side to flat strings, so event pins
  get correct zh for free.
- **`parseActionType`** — ship the `'unknown'` fix with the `content` action. Small cleanup, not
  architectural: OTA lands immediately and no released client expects a `miniapp` action.
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
- [App ADR 0006 — mini-app webview & push architecture](decisions/0006-miniapp-webview-push-architecture.md)
- [App ADR 0002 — no notification inbox](decisions/0002-no-notification-inbox.md) — amended by the event map inbox. *(Distinct from umbrella ADR 0002, pull-based config contracts, cited in §4.1.)*

> The last two links do not resolve yet: `docs/decisions/` arrives with the `integrate/app-backlog`
> merge, which is Phase 0 of [skkuverse#11](https://github.com/spencer0124/skkuverse/issues/11) and a
> prerequisite for the webview origin gate this document depends on (§7.1).
