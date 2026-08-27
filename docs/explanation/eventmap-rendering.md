---
title: Event Map Rendering
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-27
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

> [!NOTE]
> **The silent lever is currently unreachable.** Mini-app push is deferred and the subscription
> toggle has been removed, so no device holds the `miniapp:<id>` topic a refresh would be sent to.
> `refreshAfterSec` polling is what keeps the map fresh until that changes. Tracked in [skkuverse#49](https://github.com/spencer0124/skkuverse/issues/49).

**Silent push** (`type: 'eventmap-refresh'`, data-only) invalidates the manifest query, and only
that one: a new version carries a new `snapshotUrl`, and a new URL is a new query key, so the
snapshot refetches on its own.

The app-side entry point is `apps/mobile/src/services/silent-push.ts`, shared by
`background-messaging.ts` (registered at module scope in `index.ts`) and the foreground message
handler — the same payload can arrive in either state and has to do the same thing in both. It is
deliberately absent from the notification router, because a silent push never produces a tap.

**How much this lever is actually worth, stated plainly**, because "~135 s to ~0 s" is only true in
one of the three states:

| App state | Effect |
| --- | --- |
| Foreground | The query is mounted, so invalidation refetches immediately. This is the real case |
| Backgrounded, process alive | Marked stale only; `focusManager` refetches on resume |
| Quit | The handler runs in a throwaway JS context with an empty cache, so this is a no-op — and iOS delivers no background push to a force-quit app at all |

iOS throttles `apns-priority: 5` at its own discretion on top of that. So the correction path that
must not fail is `refreshAfterSec` polling plus ETag/304 revalidation; the silent push accelerates
it in the foreground and does not replace it. Verify both before relying on either — the
manifest must return a non-null `activeLayerSetId`, a second poll must return `304`, and
`refreshAfterSec` must be present.

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

### 4.1 How chips compose

The wire carries predicates and never says how to combine them, and
[ADR 0004](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md)
puts predicate evaluation on the client. So the composition rule is the app's, and it lives in
`selectMatchingItems` (`packages/shared/src/eventmap/derive.ts`):

| Scope | Rule | Why |
| --- | --- | --- |
| Within a group | **OR** | A group is one axis. Selecting both 주간 and 야간 widens it <!-- conventions:allow-korean: ESKARA's shipped chip labels --> |
| Across groups | **AND** | Groups are independent axes. Adding 먹거리 to 야간 narrows <!-- conventions:allow-korean: ESKARA's shipped chip labels --> |
| A group with nothing selected | **no constraint** | The answer to "you chose nothing" must never be an empty map |

The empty case is worth stating because ESKARA does not rely on it: its `day` group spells "all" as
an explicit `day_all` chip whose predicate is `['all']`. But a group can still arrive empty — every
chip deselected, or every selected id dropped by the parser — and the failure would be silent and
total.

The same reasoning covers a selected id with no surviving chip: the parser drops a chip whose
predicate fails validation, so a persisted selection can outlive the chip that named it. It is
ignored rather than counted as a miss, because otherwise one config typo empties the map.

**Chips filter items, and stacks are rebuilt from the survivors.** Never the other way round:
`selectVisibleStacks` matches on `stack.lead` alone, so filtering at stack level would drop a booth
the user explicitly asked for merely because the booth sharing its `stackKey` sorts first — and the
marker caption's `+N` would count items that are no longer shown.

The unfiltered stacks stay available as `allStacks`, and that is what an open peek sheet and a
`skkuverse://map?place=` link resolve against. A shared link has to reach a booth the recipient's
chips happen to hide, and toggling a chip must not slam shut a sheet someone is reading.

### 4.2 Sort is only observable in the list

`sorts[]` is server-declared: an arbitrary `id` plus a `by` from the closed set
`order | title | startAt`. Key selection off `id` and the comparator off `by` — ESKARA proves they
differ, <!-- conventions:allow-korean: ESKARA's shipped sort label --> since its 추천순 sort has `id: 'manual'` and `by: 'order'`.

Sorting has no effect on pins, which are positional, nor inside one pin's peek sheet, whose order is
`compareForStack`'s. It is therefore visible **only** in `EventMapListSheet`, which is why the sort
control lives there and deliberately not in `FilterSheet` — a sort selector beside the filters would
be a control that appears to do nothing, the same dead-control shape the distance sort is hidden to
avoid.

Every comparator falls through to `id`, for the reason `compareForStack` already documents: the list
re-derives on every `statusEpoch` tick, so a tie is a list that reshuffles itself while it is being
read.

### 4.3 Parity with the server

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

### 5.1 Derivation runs against the device clock

```ts
const now = Date.now();

// per item, per render
if (item.startAt == null && item.endAt == null) return item.status;  // server says do not recompute
if (item.startAt != null && now < startAt)      return 'upcoming';
if (item.endAt   != null && now >= endAt)       return 'closed';     // half-open, matches the server
return 'open';
```

Bounds are absolute instants, never wall-clock strings, so the device's **timezone** cannot change
the answer — a phone set to Bangkok derives exactly what a phone set to Seoul does. `clock.test.ts`
pins that with a bar running past midnight.

A device whose **clock** is genuinely wrong (manually set, dead RTC, never reached NTP) does derive
wrongly, and that is accepted rather than corrected. An earlier design measured the skew from the
manifest's `Date` header, persisted it, and derived against `Date.now() + offset`; it was removed as
more machinery than the rare case justified — the trade is recorded in
[ADR 0007](../decisions/0007-device-clock-event-map-status.md). The planned mitigation is a warning
shown when the device timezone is not `Asia/Seoul` — which is a different guarantee, and deliberately
a weaker one: it catches a misconfigured zone, not a misconfigured clock. Nothing warns today.

The snapshot's `timezone` is what that warning would compare against, and it is why the parser still
carries a field nothing reads. Dropping it as dead weight would leave the warning hardcoding
`Asia/Seoul` in the app — a per-event value frozen into a client release, which is the split
[ADR 0004](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md)
exists to prevent.

### 5.2 The next boundary is computed locally

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
  sortId, selectedStackKey }
```

Persisted: everything except `selectedStackKey` — a peek sheet reopening on cold start, for a booth
tapped yesterday, is never right.

**The persisted blob is schema-versioned**, with `version` and `migrate` in
`packages/shared/src/store/eventmap.ts`. The current migration deletes a stored `clockOffset`, left
behind by the design §5.1 describes: dropping a key from `partialize` only stops new writes, and
persist shallow-merges the stored blob over the initial state, so an existing install would rehydrate
it as a property the types no longer describe. Every bump is **one-directional** — an OTA rollback to
a bundle published before it finds the newer `version` in MMKV, has no way down, and discards the
blob, so layer visibility, chips and sort all revert to defaults. Nothing irreplaceable is lost, but
it is silent, and it reaches you as "my filters reset" rather than as a rollback symptom.

`initFromSnapshot` seeds defaults for **unknown ids only**, mirroring `initFromConfig` so user toggles
survive a refetch — except when `activeLayerSetId` changes, which means a different event entirely and
starts clean. That reset is what bounds the persisted blob to one event's worth of keys.

The write side is `toggleLayer`, `toggleChip`, `clearChips` and `setSortId` — every one of them a user
gesture, and that is a constraint rather than a coincidence. A write here re-renders every
`useEventMap()` consumer, since zustand compares with `Object.is` and the hooks subscribe to whole
slices, and it costs an MMKV write on top. Nothing on a polling cadence belongs in this store: the
clock offset was written on every manifest poll, which re-rendered `CampusScreen` and the pin layer
for the whole of an event without changing a single derived value.

`toggleChip` takes the group's `selection` as an argument rather than reading it from a stored
snapshot, because the store deliberately keeps no copy of one — the caller already holds the group in
order to render it.

Its two halves differ on purpose. A `multi` group toggles in place and **may be emptied**, which §4.1
reads as "no constraint". A `single` group **replaces and refuses to empty**: deselecting the active
chip has no meaning the config can express, since ESKARA spells that case as an explicit `day_all`
chip, so re-tapping is inert rather than a silent widening to everything. `clearChips` restores each
group's `defaultSelected` set for the same reason — resetting to nothing would be a different state
from the one the server shipped.

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
| `packages/shared/src/eventmap/clock.ts` | status derivation, `nextBoundaryAfter` (§5) |
| `packages/shared/src/eventmap/predicate.ts` | `evaluatePredicate` + `isValidPredicate` (§4) |
| `packages/shared/src/eventmap/parser.ts` | tolerant parse → `{ snapshot, dropped }` (§3) |
| `packages/shared/src/eventmap/derive.ts` | status re-derivation, stack building, visible-stack selection (§6.2) |
| `packages/shared/src/eventmap/{repository,useEventMap}.ts` | fetch, MMKV last-known-good, hooks (§2) |
| `packages/shared/src/store/eventmap.ts` | client state (§8) |
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

Added in Phase 6 ([skkuverse#18](https://github.com/spencer0124/skkuverse/issues/18)):

| File | What |
| --- | --- |
| `packages/shared/src/eventmap/derive.ts` | `selectMatchingItems` (§4.1) and `sortItems` (§4.2), beside the Phase 3 transforms |
| `packages/shared/src/eventmap/card.ts` | `resolveSlots` — template slots the item can actually fill |
| `packages/shared/src/store/eventmap.ts` | `toggleChip`, `clearChips`, `setSortId` (§8) |
| `apps/mobile/src/features/eventmap/CardRenderer.tsx` | draws resolved slots in declared order; `compact` for list rows |
| `apps/mobile/src/features/eventmap/EventMapChipRow.tsx` | unlabelled groups as one-tap toggles over the map |
| `apps/mobile/src/features/eventmap/EventMapListSheet.tsx` | the list, and the only home for the sort control |
| `apps/mobile/src/features/map/components/FilterSheet.tsx` | every chip group, under the existing campus and base-layer pills |
| `apps/mobile/src/features/map/components/FilterButton.tsx` | given an entry point at last, plus an active-filter count badge |
| `apps/mobile/src/components/glass.tsx` | moved out of the mini-app feature; `GlassChip` gained `selected` |
| `packages/shared/src/tokens/shadows.ts` | `glassFloat`, promoted from two hand-rolled copies |

`EventMapPinLayer` needed **no change**: it is a pure `React.memo` over the stacks it is handed, so a
chip filters it by changing a prop.

The card body is now entirely the server's. What `EventMapPeekSheet` keeps is what no template
describes — the sheet chrome and the actions row, including `ActionButton`'s dismiss-before-navigate,
which is a portal ordering constraint (§7.1) rather than a styling choice.

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
- **A horizontal `ScrollView` over the map eats a full-width touch band.** It stretches to its
  parent's width whether or not it draws anything there, so a one-chip strip would cost a whole band
  of map panning. `EventMapChipRow` is a wrapping row sized with `alignSelf: 'flex-start'` under
  `pointerEvents="box-none"` instead.
- **The card body follows the template's declared order.** ESKARA's `booth` template starts
  `[thumbnail, title, …]`, so the thumbnail is a block **above** the title rather than beside it. A
  "if slot 0 is a thumbnail and slot 1 a title, lay them out as a row" rule would hold for exactly
  the three templates shipping today and silently mis-render the fourth.
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
- [App ADR 0007 — status derives against the device clock](../decisions/0007-device-clock-event-map-status.md) — the reasoning behind §5.1
- [App ADR 0002 — no notification inbox](../decisions/0002-no-notification-inbox.md) — amended by the event map inbox. *(Distinct from umbrella ADR 0002, pull-based config contracts, cited in §4.1.)*
