---
title: Event Map Rendering
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-29
audience: internal
---

# Event Map Rendering

> How the app consumes the event map contract. It decides nothing: which layers exist, what is open,
> which layer a booth belongs to all arrive as data. Ownership is
> [ADR 0004](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md);
> the server side is [`eventmap-api.md`](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/eventmap-api.md).

## 1. Summary

| | |
| --- | --- |
| Requests | `GET /eventmap/manifest` (poll) → `GET /eventmap/snapshot/:id/:version` (immutable) |
| Shared code | `packages/shared/src/eventmap/`: types, parser, derive, hooks, store |
| App code | `apps/mobile/src/features/eventmap/`: the peek sheet, the list panel, the card renderer |
| Touched | `CampusScreen`, `MapMarkerLayer`, `FilterSheet`, `map/parser.ts`, `types/sdui.ts`, `features/search/store.ts`, `+native-intent.tsx` |
| Pins | Ordinary `/map/config` marker layers, drawn by `MapMarkerLayer` (§6) |

The app computes exactly one thing, and it is not a business rule: **status**, recomputed against
the device clock (§5). Everything else arrives resolved. Which layer an item belongs to is
`item.layerId` — a `/map/config` layer id, stamped server-side by the same resolver that stamps the
item's marker (§4).

The map renders **places**. It has no concept of an event, a booth, or a mini-app; those reach the
user only through the action union (§7).

## 2. Fetch path

Cold start is two requests. Every poll after that is one small request that usually returns **304**. The
snapshot carries structure and items together, so a sort or a layer toggle costs **zero** network.

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
| any field | parser | ignored — within a schema version the wire is additive-only |
| `schemaVersion` other than the app's | parser | ignore the snapshot; base map intact — **older as well as newer**, see below |
| `item.layerId` missing | parser | drop the item, count it |
| `sort.by` | parser | drop that sort option |
| `item.status` | parser | coerce to `unknown` |
| card slot → missing field | `CardRenderer` | render nothing for that slot |
| `actionType` | `parseActionType` | `'unknown'`; `handleSduiAction` no-ops it |

**The schema gate is an exact match.** A version bump is a breaking change — v2 removed the
predicate layers, the chip groups and the icon table, and made `layerId` required — and the
last-known-good cache outlives an app update, so the blob a previous build wrote reaches the parser
too. Read as the current schema it would parse into an event whose every item is dropped: the
event counted as active, the list announcing nothing. "No event" is the honest answer. The stale
blob is rejected once, and the next successful fetch overwrites it under the same cache key, so
nothing is orphaned in MMKV.

## 4. Layer membership and the list

An item belongs to exactly one `/map/config` layer, named by `item.layerId`. That id is the same one
its marker carries on `/map/markers/event`, because the server stamps both through one resolver
over the festival config's `itemDefaults` — so the pin and the row can never disagree about which
layer a booth is in. The app never derives membership; there is nothing to evaluate.

### 4.1 The list shows the items of the visible layers

`selectVisibleItems` (`packages/shared/src/eventmap/derive.ts`) keeps the items whose layer is drawn:
the layer exists in the served config **and** `isLayerVisible(layer, states)` — the same function the
render loop, the filter badge, the filter sheet's tiles and the chips read. It is the fifth reader of
that function, deliberately not a fifth copy: the one time a reader carried its own expression, the
filter sheet showed 건물번호 ON while the map hid it. <!-- conventions:allow-korean: the layer label the app shows -->

An item naming a layer this build was not served is not listed. There is no pin for it either — the
marker route serves markers per served layer — so the two stay in step for an id outside the
activation window too. Input order is preserved, so the sort (§4.2) applied upstream survives.

The list describes the layer; the pin describes the moment. `MapMarkerLayer` additionally draws a
marker only inside its own `startAt`/`endAt` window (`useVisibleByWindow`), so a session that has
ended keeps its row — with the status badge saying so — while its pin is gone. Verified on the
simulator the day after the demo sessions: 주점 listed 28 rows and drew no pin, the in-window stage
marker drew beside its two rows. <!-- conventions:allow-korean: the chip label the app shows -->

The list lives **in the campus sheet**, in place of the server's campus feed, while a chip has
narrowed the map (`findNarrowedChip` in `packages/shared/src/map/chips.ts` returns one). The sheet's
body is one gorhom scrollable or the other, never both, since they cannot nest. The sheet snaps to
its middle detent when the list appears — enough to read a few rows with the pins still showing —
and the feed returns when the narrowing is cleared. Two consequences worth knowing:

- Narrowing through the filter sheet's tiles reveals the list the same way. The reveal is an effect
  on the derived flag, not a call inside the chip handler.
- The reset chip restores the group's defaults, which `findNarrowedChip` reads as "narrowed to
  nothing", so it lights the festival pins and flies there but leaves the feed in the sheet. If that
  reads wrong on device, the alternative — showing the list whenever any event layer is visible —
  would replace the feed for the whole festival, which is a product call rather than a code one.

Every stack stays available to a pin tap, a deep link and an already-open peek sheet regardless of
the filter (`useEventMap().stacks`): a shared link must reach a booth whose layer the recipient
happens to have hidden, and hiding a layer must not slam shut a sheet someone is reading.

### 4.2 Sort is only observable in the list

`sorts[]` is server-declared: an arbitrary `id` plus a `by` from the closed set
`order | title | startAt`. Key selection off `id` and the comparator off `by` — ESKARA proves they
differ, <!-- conventions:allow-korean: ESKARA's shipped sort label --> since its 추천순 sort has `id: 'manual'` and `by: 'order'`.

Sorting has no effect on pins, which are positional, nor inside one pin's peek sheet, whose order is
`compareForStack`'s. It is therefore visible **only** in `EventListPanel`, which is why the sort
control lives there and deliberately not in `FilterSheet` — a sort selector beside the filters would
be a control that appears to do nothing, the same dead-control shape the distance sort is hidden to
avoid.

Every comparator falls through to `id`, for the reason `compareForStack` already documents: the list
re-derives on every `statusEpoch` tick, so a tie is a list that reshuffles itself while it is being
read.

### 4.3 The join is a contract, not a convention

The design rests on `marker.layerId === item.layerId` for the same booth. The server guarantees it by
construction — one table, one resolver — and this repo pins its half: the parser test parses the
hand-maintained snapshot fixture and asserts every item's `layerId` is a layer id in the captured
live `/map/config` (`map/__tests__/fixtures/map-config-live.json`). A festival layer renamed on the
server fails that test rather than silently emptying the list.

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

Booth pins are drawn by `MapMarkerLayer`, one `<NaverMapMarkerOverlay>` per marker the server
serves, exactly as the building layers are. The choice of overlays over the SDK's clusterer predates
that and still holds. Verified against the current release, not assumed: we run 2.7.0, latest is
2.9.0, and `src/types/ClusterMarkerProp.ts` is **byte-identical** between them.

| | `NaverMapMarkerOverlay` | `ClusterMarkerProp` |
| --- | --- | --- |
| `caption` / `subCaption` | ✅ | ❌ |
| `alpha` (dim when closed) | ✅ icon together with caption | ❌ |
| per-marker `onTap` | ✅ | ❌ map-level `onTapClusterLeaf` |
| `anchor`, `tintColor`, `minZoom`/`maxZoom` | ✅ | ❌ |
| `zIndex` / `globalZIndex`, children | ✅ | ❌ |

A cluster leaf accepts only `identifier`, `latitude`, `longitude`, `image`, `width`, `height`. It
would erase booth **names** — the primary affordance at a festival — and make dim-when-closed
inexpressible. The building layer already draws 100+ overlay markers on this same screen.

Upstream is `mym0404/react-native-naver-map` and this is unlikely to change: issue **#23** was opened
by the maintainer in 2024 promising these options and was stale-bot closed undelivered; PR **#139**
(cluster image + leaf caption) has been open and stalled on CI since 2025-09-24; issue **#22** (iOS
`screenDistance` broken) was stale-closed with no fix.

- There is **no cluster-teardown flicker to design around.** Layer toggles touch React children only.
  (`clusters` is keyed by a hash of the whole marker array, and **both** platforms wipe every
  clusterer when it changes — iOS `RNCNaverMapView.mm:234-245`, Android `RNCNaverMapViewManager.kt:547-556`.)
- The `updateLeafMarker` marker-reuse warning in Naver's native docs is an **Android SDK concern that
  does not apply** at the RN declarative layer.

### 6.1 Density levers, in order

1. `isHideCollidedCaptions` — already used by the `textLabel` branch of `MapMarkerLayer`
2. **`stackKey`**

### 6.2 `stackKey`

Same plot, two occupants (a daytime booth and a night stall) means two items at identical coordinates.

The server emits `stackKey` and `pinPriority`. The client groups items by `stackKey` (`buildStacks`),
and a tap on a booth's pin opens a peek sheet listing every item sharing the key, lead first — the
highest `pinPriority`, ties broken by status rank `open > upcoming > closed > unknown`, then `order`,
then `id`. That is a total order on purpose: a partial one lets the lead differ between two renders
of the same data, and the peek sheet's first card would flicker on every status tick.

Generic on purpose: `stackKey` is a string the server chooses. Normally `placeId`; if the main field is too
dense the server switches it to `zone`. **No data change, no app release.**

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
skkuverse://map?place=<kind>:<placeId>
```

Independent of any consumer. A booth and a building are addressed identically, because both are
places; the kinded form is literally the two fields of a marker's `tap`, so a link copied from one
can never disagree with it. It needed almost no new machinery — the search→map handoff already did
this work, so a deep link became a **second producer** for the same store (`useMapNavStore`, in
`features/search/store.ts`).

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
falling through to the webview SVG floor map.** The `place` value is shape-checked but not looked up:
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

`useEventMapStore` (Zustand):

```ts
{ activeLayerSetId, sortId, selectedStackKey }
```

Persisted: `activeLayerSetId` and `sortId`. Never `selectedStackKey` — a peek sheet reopening on cold
start, for a booth tapped yesterday, is never right.

**The persisted blob is schema-versioned**, with `version` and `migrate` in
`packages/shared/src/store/eventmap.ts`. Every bump so far has been a key leaving: `clockOffset`
(the design §5.1 describes), then `layerVisibility` and `selectedChips` when the snapshot stopped
carrying layers and chip groups. Dropping a key from `partialize` only stops new writes, and persist
shallow-merges the stored blob over the initial state, so an existing install would rehydrate it as
a property the types no longer describe. The migration deletes them, and the store test calls
`persist.getOptions().migrate` on a v2 blob to prove it. Every bump is **one-directional** — an OTA
rollback to a bundle published before it finds the newer `version` in MMKV, has no way down, and
discards the blob, so the sort reverts to the snapshot's first. Nothing irreplaceable is lost, but
it is silent.

`initFromSnapshot` seeds the sort from the snapshot's first entry when the layer set changes — a
different event starts clean — and otherwise keeps the user's choice, so a refetch cannot undo a sort
they just picked. The write side is `setSortId` and `setSelectedStackKey`, both user gestures, and
that is a constraint rather than a coincidence: a write here re-renders every `useEventMap()`
consumer and costs an MMKV write. Nothing on a polling cadence belongs in this store — the clock
offset was written on every manifest poll, which re-rendered `CampusScreen` for the whole of an event
without changing a single derived value.

**Layer visibility is not here.** Festival layers are ordinary `/map/config` layers, so their
visibility lives in `useMapLayerStore` with every other layer's — ephemeral, seeded from each layer's
`defaultVisible` on launch, written by chips and by the filter sheet's tiles. Two stores, two
lifetimes: that one is the map's, this one is the event's, and keeping event keys out of the map's
is what stops a persisted blob accumulating a festival's worth of dead ids.

### 8.1 `basemapOverride` is gone

The snapshot used to name base-map layers the event forced to a visibility — in practice one
boolean, hiding the building numbers while the festival ran. It is gone on both sides: the server no
longer ships it and nothing here reads it. Visibility is `userToggle[id] ?? layer.defaultVisible`
everywhere it is read, and an event layer is an ordinary layer with no way to reach across and change
another's.

The removal is worth recording rather than just doing, because the cost was not the field. It was
that a cross-cutting override is a **resolution rule** every reader has to implement identically:
`FilterSheet` implemented two tiers of the three and so reported the building-number layer ON
while the map drew nothing. Two tiers cannot drift that way, because `defaultVisible` travels on the
layer the caller is already holding. If a festival wants the building numbers off, that is now a
`/map/config` `defaultVisible` question.

## 9. Where the code lives

Phase 3 ([skkuverse#15](https://github.com/spencer0124/skkuverse/issues/15)) built the fetch, parse
and status core; Phase 6 ([skkuverse#18](https://github.com/spencer0124/skkuverse/issues/18)) added
the cards, sort and list; the v2 contract
([skkuverse-server#109](https://github.com/spencer0124/skkuverse-server/pull/109)) moved layer
membership to the server and the list into the campus sheet.

| File | What |
| --- | --- |
| `packages/shared/src/types/eventmap.ts` | wire types, mirrored from the server with a name-mapping table in the header |
| `packages/shared/src/eventmap/clock.ts` | status derivation, `nextBoundaryAfter` (§5) |
| `packages/shared/src/eventmap/parser.ts` | tolerant parse → `{ snapshot, dropped }` (§3) |
| `packages/shared/src/eventmap/derive.ts` | status re-derivation, stack building (§6.2), `selectVisibleItems` (§4.1), `sortItems` (§4.2) |
| `packages/shared/src/eventmap/card.ts` | `resolveSlots` — template slots the item can actually fill |
| `packages/shared/src/eventmap/{repository,useEventMap}.ts` | fetch, MMKV last-known-good, hooks (§2) |
| `packages/shared/src/store/eventmap.ts` | client state (§8) |
| `packages/shared/src/map/chips.ts` | `isLayerVisible` and the chip rules the list borrows (§4.1) |
| `apps/mobile/src/features/eventmap/CardRenderer.tsx` | draws resolved slots in declared order; `compact` for list rows |
| `apps/mobile/src/features/eventmap/EventListPanel.tsx` | the list, in the campus sheet; the only home for the sort control |
| `apps/mobile/src/features/eventmap/EventMapPeekSheet.tsx` | stacked-place sheet + action buttons |
| `apps/mobile/src/lib/pending-map-place-link.ts` | deferred deep-link intent (§7.2) |
| `apps/mobile/src/features/map/CampusScreen.tsx` | routes marker taps on `tap.kind`, joins items to layers, swaps the sheet body, resolves place links |
| `apps/mobile/src/features/map/components/MapMarkerLayer.tsx` | draws every `/map/config` layer, booth pins included |
| `apps/mobile/src/components/glass.tsx` | moved out of the mini-app feature; `GlassChip` gained `selected` |
| `packages/shared/src/tokens/shadows.ts` | `glassFloat`, promoted from two hand-rolled copies |

> [!IMPORTANT]
> **Booth pins come from `/map/config`, not the snapshot.** The server serves them as ordinary
> `placeDot` marker layers on `/map/markers/event`, each with `tap: { kind: 'event', placeId }`, so
> `MapMarkerLayer` draws them like any other layer and nothing in the snapshot is ever drawn. The
> snapshot is fetched for what only it has — the card templates, the sorts, and the items the peek
> sheet and the list render — joined to the pins by `placeId` (a tap) and `layerId` (the list). The
> chips over the map are `/map/config`'s too, carrying an action and a layer set rather than a
> predicate; see [map-config-api-spec.md](../reference/map-config-api-spec.md). The marker contract
> is `skkuverse-server/docs/reference/map-markers-api.md`.

Fixed on the way through: the map parser's unchecked union casts and silent `(0,0)` coordinates,
`parseActionType`'s unknown → `'external'`, the stale offline `DEFAULT_MAP_CONFIG`, hardcoded caption
colours, and the custom-scheme authority defect that had silently broken every
`skkuverse://<segment>` link.

`CampusNaverMap` needed **no change** — it already forwards `children` verbatim into `NaverMapView`,
and no phase has needed a new map-level prop.

The card body is entirely the server's. What `EventMapPeekSheet` keeps is what no template
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
- **The card body follows the template's declared order.** ESKARA's `booth` template starts
  `[thumbnail, title, …]`, so the thumbnail is a block **above** the title rather than beside it. A
  "if slot 0 is a thumbnail and slot 1 a title, lay them out as a row" rule would hold for exactly
  the three templates shipping today and silently mis-render the fourth.
- **Do not bump `@mj-studio/react-native-naver-map`.** 2.9.0 changes nothing about clustering and
  bumps the native Naver SDK, so it needs `expo prebuild --clean` plus a manual `runtimeVersion` bump.
  Separately, `patches/@mj-studio+react-native-naver-map+2.7.0.patch` is now redundant — PR #184
  (ours) shipped upstream in v2.7.1 with a better fix.
- **`useMapConfig` must keep its never-throw fallback.** The event map is a separate request precisely
  so a map-config hiccup cannot take it down, and vice versa — which is also why the item-to-layer
  join happens in `CampusScreen`, the one place holding both, rather than inside `useEventMap`.

## 11. Related

- [ADR 0004 — event map layer ownership](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md)
- [Server API reference](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/eventmap-api.md)
- [Implementation plan — skkuverse#11](https://github.com/spencer0124/skkuverse/issues/11)
- [Android Naver map markers](android-naver-map-markers.md) — the bitmap-snapshot race `MapMarkerLayer` avoids
- [App ADR 0006 — mini-app webview & push architecture](../decisions/0006-miniapp-webview-push-architecture.md)
- [App ADR 0007 — status derives against the device clock](../decisions/0007-device-clock-event-map-status.md) — the reasoning behind §5.1
- [App ADR 0002 — no notification inbox](../decisions/0002-no-notification-inbox.md) — amended by the event map inbox. *(Distinct from umbrella ADR 0002, pull-based config contracts.)*
