---
title: Event Map Rendering
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-24
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
| Requests | `GET /map/overlays/event` — the same overlay query the pins already make. There is no `/eventmap` route |
| Shared code | `packages/shared/src/map/`: `parser.ts`, `window.ts`, `daily-window.ts`, `chips.ts`, `pins.ts`, `list.ts`, `text.ts`, plus `store/map.ts` and `store/eventmap.ts` |
| App code | `apps/mobile/src/features/eventmap/` — peek sheet, list panel, place card |
| Touched | `CampusScreen`, `MapOverlayLayer`, `FilterSheet`, `+native-intent.tsx` |
| Pins | Ordinary `/map/config` layers, drawn by `MapOverlayLayer` (§6). A layer no longer names a renderer — each overlay's `kind` does, so the same layer may also carry a zone or a route line |

The app computes exactly two things, and neither is a business rule: **openness**, against the device
clock (§5), and **which pin wins a shared coordinate** (§6.3). Everything else arrives resolved.
Which layer a place belongs to is `layerId` — a `/map/config` layer id, stamped server-side by the
same resolver that stamps its marker (§4).

The map renders **places**. It has no concept of an event, a booth, or a mini-app; those reach the
user only through the action union (§7).

### 1.1 What replaced the snapshot tier

The festival used to reach the app twice: once as a versioned, hashed, per-language snapshot
(`/eventmap/manifest` + `/eventmap/snapshot`, materialized by a 60 s poller) and once as ordinary
markers on `/map/overlays/event`. That was one set of documents projected twice, with two
vocabularies and a publish pipeline existing only to keep the first cacheable.

The server deleted the first. A place is now one document carrying its own `subtitle`, `hours`,
`fields` and `actions`, and it reaches the app on the marker wire. **The pins the map already
fetches are the data the list and the peek sheet render.** What left the client with it:

| Gone | Replaced by |
| --- | --- |
| `useEventMap`, the manifest and snapshot queries, the MMKV last-known-good cache | `useLayerOverlays` on the festival layer's own `endpoint` |
| `schemaVersion` and its exact-match gate | nothing — there is no envelope left to version |
| `cardTemplates`, `EventMapCardSlot`, `resolveSlots`, `CardRenderer` | `PlaceCard`, a fixed layout over `subtitle` / `hours` / `fields` |
| `sorts` declared by the server | nothing — the list has one order, the author's `order` (§4.2) |
| `status` on the wire, `ItemStatus`, `deriveItemStatus` | `isOpenNow(hours, now)` (§5) |
| `stackKey`, `buildStacks`, stacked peek cards | `resolvePinCollisions` (§6.3); a tap is one place |
| `eventmap-refresh` silent push, `services/silent-push.ts` | nothing — the server deleted the sender |

## 2. Fetch path

One request, and it is not this feature's own. `MapOverlayLayer` fetches `layer.endpoint` for every
drawn layer, the marker cache is keyed on that endpoint string, and every festival layer shares
`/map/overlays/event` — so the list, the peek sheet and six layers of pins are one fetch and one cache
entry. `CampusScreen` reads the same query key rather than issuing a second.

| Hook | Endpoint | staleTime | On failure |
| --- | --- | --- | --- |
| `useLayerOverlays(endpoint, enabled)` | the layer's own `endpoint` | 10 min | throws → the query is in error and the layer draws nothing |

The endpoint is read off the served layers (`layers.find(isFestivalLayer)?.endpoint`), never
hardcoded: the route is named for the mechanism rather than the festival, so next year's event
changes the layer set and not the URL — and this build has to know neither.

`Cache-Control` on that route is `public, max-age=60`. The **window arithmetic needs no refetch at
all**: opening and closing times ride in the payload and the device re-derives, which is what keeps
the map truthful on the dead network a festival actually has (§5).

**The freshness machinery is gone with the tier that needed it**: polling, the `nextChangeAt` hint
and the silent push all belonged to the snapshot. What replaced the scheduling half is
`useWindowClock`, a one-shot timer armed at the next opening or closing boundary — the payload is
byte-identical either side of one, so without it 18:00 passes with every pill still reading 준비중. <!-- conventions:allow-korean: the literal string the app shows -->

## 3. Tolerant parsing

The server fails loud on config it can fix. The client fails soft on a payload it can only render.

| Unknown | Enforced in | Behaviour |
| --- | --- | --- |
| any field | `parseOverlayData` | ignored — the wire is additive-only |
| unknown `kind` | `parseOverlayData` | drop that ONE overlay, keep its layer and every sibling — which is what makes a new renderer a non-breaking server change |
| geometry absent, malformed, or wrong for the `kind` | `parseOverlayData` | drop the overlay — a ring missing a corner is a different shape, and drawing the wrong outline over a campus beats nothing only in the sense that it is worse |
| missing `id`, `layerId`, `text.ko` | `parseOverlayData` | drop the marker |
| coordinate absent, unparseable, or `\|lat\| > 90` | `parseOverlayData` | drop the marker — a swapped pair puts it in the ocean and never throws |
| unknown `campus` | `parseOverlayData` | drop the marker, rather than put it on the wrong map |
| unknown `tap.kind` | `parseMarkerTap` | `tap: null` — still a place worth drawing, just inert |
| half-bounded or unparseable window | `parseHours` | drop that window (§5) |
| field row missing a label or a value | `parseFields` | drop the row |
| action missing an id, label or value | `parseActions` | drop the button, serve the place |
| unknown `actionType` | `parseActionType` | `'unknown'`; `handleSduiAction` no-ops it |
| `order` / `pinPriority` not a number | `parseOverlayData` | `0`, never `NaN` — see below |

**`NaN` is the failure mode worth naming.** Every comparison against it is false, so a `NaN` sort key
makes the collision ladder non-total and a `NaN` window bound makes a place permanently closed — both
silent, both with no line of code to blame. `toFiniteNumber` and the both-bounds check exist for
exactly that.

## 4. Layer membership and the list

A place belongs to exactly one `/map/config` layer, named by its marker's `layerId`. The server
resolves that from the place's `category` through the layer set's `itemDefaults` — one table, one
resolver — which is what keeps a 주점 pin on the layer the 주점 chip shows. <!-- conventions:allow-korean: the chip label the app shows --> The app never derives
membership. There is nothing to evaluate.

Because the list and the pins are now **the same array**, the join that used to hold this together is
gone rather than merely guaranteed. There is no second projection to disagree with the first.

### 4.1 The list shows the places of the visible layers

`selectVisibleMarkers` (`packages/shared/src/map/list.ts`) keeps the markers whose layer is drawn: the
layer exists in the served config, plus `isLayerVisible(layer, state, now)` — the same function the
render loop, the filter sheet's tiles and the chips read. It is a fourth reader of that function,
deliberately not a fourth copy: the one time a reader carried its own expression, the filter sheet
showed 건물번호 ON while the map hid it. <!-- conventions:allow-korean: the layer label the app shows -->

A marker naming a layer this build was not served is not listed. There is no pin for it either — the
marker route serves markers per served layer — so the two stay in step for an id outside the
activation window too.

**An inert overlay (`tap: null`) is not listed.** A row is a way to a place, and a background zone or
a label-only overlay has nowhere to go: listing it would open an all-but-empty sheet. It is still
drawn — the filter is on the list, not on the render loop — so a zone's label can share its layer
and switch on and off with it without adding a row.

**The list describes the layer. The pin describes the coordinate.** A place suppressed by the
collision ladder (§6.3) keeps its row: losing a shared spot to whoever is open at this hour says
nothing about whether the place exists. This is the one place the two views deliberately differ, and
it is why selection and collision live in separate modules.

The list lives **in the campus sheet**, in place of the server's campus feed, while a chip has
narrowed the map (`useMapLayerStore`'s `chip`, looked up in the served chip list). The sheet's
body is one gorhom scrollable or the other, never both, since they cannot nest. The sheet snaps to
its middle detent when the list appears — enough to read a few rows with the pins still showing —
and the feed returns when the narrowing is cleared. When a row or a pin opens the peek sheet, the
campus sheet closes first and the peek sheet rises once that animation finishes. It comes back to
the same detent, list and all, when the peek sheet is dismissed — the hand-off is described in
[bottom-sheet-system.md](bottom-sheet-system.md). Both of these follow from it:

- Narrowing through the filter sheet's tiles reveals the list the same way. The reveal is an effect
  on the derived flag, not a call inside the chip handler.
- The reset chip (`isReset` on the wire) CLEARS the narrowing rather than applying one, so it lights
  the festival pins and flies there but leaves the feed in the sheet. If that reads wrong on device,
  the alternative — showing the list whenever any event layer is visible — would replace the feed for
  the whole festival, which is a product call rather than a code one.
- **A narrowing with no row shows no list.** A chip whose layers hold only inert overlays — the 통제 <!-- conventions:allow-korean: the chip label the app shows -->
  zones are drawn, not pressed — moves the camera and leaves the sheet where it was, the way the reset
  chip does. That is read off the listed places rather than declared on the chip: a flag saying "this
  chip opens no list" could disagree with the places actually served, and whether the list is empty
  depends on the user's own layer toggles, which the server cannot see.

Every place stays reachable by a pin tap, a deep link and an already-open peek sheet regardless of
the filter (`placesById` is built from **all** event markers): a shared link must reach a booth whose
layer the recipient happens to have hidden, and hiding a layer must not slam shut a sheet someone is
reading.

### 4.2 One order, chosen by the server

The list has no sort control and no count header. A chip with no `list` orders its rows by the
marker's `order`, ascending, using `sortPlaces` (`map/list.ts`). That is the position ops authored.

A chip with a `list` gets its filters and its sort from the server. The filters are one row of
dropdown chips: 일자, a single choice that opens on today, plus 운영 (총학생회 / 학생단체) on
booths, a checklist that opens on 전체. The sort is a per-day `order` for booths and 가나다 for
food trucks. The app matches the ids each overlay's `facets` carries and runs `sortForList`. Nothing
here decides which day a place is on. The app used to infer that from the dates it was served, and
one stray date renumbered every place. See
[map-config-api-spec.md § Chip lists](../reference/map-config-api-spec.md#chip-lists).

The map follows the same selection. A place the filters take out is hidden from its layer
**before** the pin collision ladder runs, because pub plots hold a different pub each night. If the
hidden night's pub stayed in the ladder, it would still win the shared plot and leave the visible
night's pub undrawn.

While a chip's layers hold any place, the list stays mounted even when a tab has no rows. The tab
shows an empty line rather than the sheet falling back to the feed, which would take the tabs with
it.

It ends at `id`. The list re-derives at every clock boundary, so a tie is a list that reshuffles
itself while it is being read.

## 5. Openness

Openness is a pure function of the device clock and the windows, and the server states the same one:

```text
hours.length === 0 || hours.some(w => now >= w.startAt && now < w.endAt)
```

`packages/shared/src/map/window.ts` is the only implementation. `opennessOf`
(`apps/mobile/src/features/eventmap/place/placeFormat.ts`) turns it into one of three pills — open,
upcoming, closed — for both the list row and the sheet, and `resolvePinCollisions` reads it as step 1
of the ladder.

### 5.1 An empty list means always open, and only that

`hours` replaced a scalar `startAt`/`endAt` pair, and the array is not merely roomier. With one
window per document a booth open on both festival days had to be **two documents**, so the list
showed every place twice with nothing on the row to tell the rows apart — 28 `bar` documents over 18
real bars in production.

The old both-bounds-null had to mean an always-on 화장실 as well as a rain-cancelled bar, which is <!-- conventions:allow-korean: the place category the app shows -->
precisely why a sibling `status` field had to exist to tell them apart, and why that field was
load-bearing rather than redundant. A cancellation is expressed by the marker not being served —
a cancelled place is deleted, not flagged — which frees `[]` to mean one thing.

Both bounds inside a window are therefore required, and `parseHours` **drops** a half-bounded one
rather than repairing it. Admitting one open end would quietly restore the second way of saying "no
limit" and bring the ambiguity back.

### 5.2 The clock, and what it is allowed to be wrong about

Bounds are absolute instants rather than wall-clock strings, so a device in the wrong **timezone**
still derives correctly — a phone set to Bangkok agrees with one set to Seoul. A phone whose
**clock** is genuinely wrong does not, and that is accepted rather than corrected (ADR 0007). An
earlier design reconciled against a response `Date` header and was removed as more machinery than the
rare case justified.

The same holds for what the rows **display**. Every time the map shows carries its date — the list
row's hours, the sheet's status line and its hours row alike read `10/1(Thu) 18:00–23:00` — because
the festival runs on two days and a bare time leaves the visitor to guess which. A window is dated by
its **start**, so one crossing midnight stays on the evening it began. The strings are built by
`packages/shared/src/map/kst-format.ts` from the epoch shifted to KST, not by `Intl`: without a
`timeZone` a phone abroad formats in its own zone, `ko-KR` renders a date as `10. 1.`, and
`hour12: false` prints midnight as `24:00` on some engines.

### 5.3 A marker's hours do not decide what is drawn

The client never hides a marker outside its windows. That filtering was how the old map coped
with a crowded field, which was a workaround for the day-split rather than a feature; layers and
chips do that job now. `useVisibleByWindow` — which filtered — became `useWindowClock`, which returns
a `now` and filters nothing. What openness still decides is which pin wins a shared coordinate (§6.3)
and how a row is labelled.

`nextWindowBoundaryAfter` finds the timer's target, and the result is clamped to `MAX_TIMEOUT_MS`:
`setTimeout` stores its delay in a signed 32-bit int, so a boundary more than ~24.8 days out
overflows and fires **immediately**, turning a far-future window into a re-render hot loop on
festival day.

> [!IMPORTANT]
> **The rule holds on the marker axis and is excepted on the layer axis.** A LAYER's
> `defaultVisibleWhen` does decide what is drawn — see §5.4. The two are different fields with
> different shapes and different jobs, and the distinction is the point: a marker's `hours`
> describe one booth on one festival day, while a layer's schedule says "주점 belongs to the <!-- conventions:allow-korean: the layer label the app shows -->
> evening", which is the same sentence every day.

### 5.4 A layer's schedule does, and it is wall-clock

`/map/config` gives each layer a `defaultVisibleWhen`, a tagged union of `always`, `never` and
`scheduled` — the last carrying `DailyWindow[]`, recurring `"HH:MM"` KST windows where
`start > end` wraps past midnight. It replaced a plain boolean, which could not say that 주점 <!-- conventions:allow-korean: the layer label the app shows -->
belongs to the evening of every festival day. The server ships the windows and never evaluates
them, so `/map/config` stays a deterministic response.

`packages/shared/src/map/daily-window.ts` is the only implementation, kept apart from `window.ts`
because that module's bounds are absolute instants and these are not. **The KST minute comes from
the epoch** — `(Date.now() + 9h) % 86_400_000`, never `Date.getHours()` — so a device in the wrong
timezone still flips 주점 on at 18:00 KST, which is the guarantee ADR 0007 makes and this axis <!-- conventions:allow-korean: the layer label the app shows -->
keeps. The fixed +09:00 is exact: Korea has had no DST since 1988.

Resolution is four tiers, and the schedule is the last resort:

```text
forced ?? chipNarrowing ?? userToggle ?? defaultVisibleAt(layer, now)
```

Every tier is a fallback rather than an assignment, which is what lets the last one keep moving.
Writing a resolved value into the store is exactly what used to happen — the store was seeded from
`defaultVisible` — and it froze the schedule at first read while making a user's choice
indistinguishable from the server's suggestion. `useMapLayerStore` now holds only `overrides` (what
the user expressed) and a transient `chip`, so clearing a chip drops a shadow and gives back what
the user had rather than what the server ships.

**An unreadable declaration is OFF, not on.** The parser produces `null` for a `kind` this build
cannot resolve, and `defaultVisibleAt` reads it as hidden. That is the opposite direction from
`userConfigurable`, deliberately: this axis exists to put *less* on screen, so reading a rule we
cannot understand as "on all day" would draw 주점 at noon the first time the server adds a kind. <!-- conventions:allow-korean: the layer label the app shows -->
`null` is also kept distinct from `{ kind: 'never' }`, which is an authoring choice. Two guards stop
that becoming a silent failure of its own — the layer keeps its filter-sheet tile so a user can turn
it on, and a response in which *no* layer is readable falls back to `DEFAULT_MAP_CONFIG` rather than
drawing an empty campus.

The layers' windows are armed on `CampusScreen`'s clock alongside the markers', and that is not
optional: a layer that is currently hidden is not mounted, so it arms no timer of its own and 18:00
would otherwise arrive with nothing in the app waiting for it.

## 6. Rendering: shapes, not clusters

Booth markers are drawn by `MapOverlayLayer`, one `<NaverMapMarkerOverlay>` per marker the server
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

### 6.1 A dot by default, a pin when selected

A place marker is a **small tinted disc**, and only the marker the peek sheet is open on becomes a
teardrop. That is Naver Map's own answer to the same problem, and the west strip is the problem: two
columns of ~40 markers, each a 22×30 teardrop, overlapping badly enough that almost no caption
survives collision.

The axis is `style.shape` on the layer — `dotThenPin` (the default), `dot`, `pin` — resolved by
`resolveMarkerGeometry` (`features/map/utils/markerShape.ts`) and nowhere else. Three things about
it are load-bearing:

- **The anchor moves with the shape.** A teardrop hangs by its tip (`y: 1`) and a disc by its centre
  (`y: 0.5`). Swapping the image on selection without swapping the anchor slides the marker off the
  coordinate it exists to mark — silently, and only for the marker being looked at. That is why the
  geometry is a tested pure function rather than three ternaries in the render loop.
- **Both states stay IMAGES.** Naver's tint blends rather than replaces, so a black source plus
  `tintColor` expresses the whole appearance: `marker-dot.png` is a black disc inside a white ring,
  and one asset therefore serves every category colour. Drawing either state as a child View would
  re-enter the Android bitmap-snapshot race, and with it Android's 40 ms re-rasterisation of every
  custom-view marker — see [android-naver-map-markers.md](android-naver-map-markers.md).
- **The dot asset carries transparent padding, and it is the tap target.** `style.size` names the
  VISIBLE disc; the overlay is told `size * DOT_CANVAS_RATIO`. An 18pt disc on a 28pt canvas is
  tappable, a bare 14pt one is not.

The selected marker also takes a positive `zIndex`, which buys draw order — it paints over its
neighbours instead of under them. It is `zIndex` rather than `globalZIndex` deliberately: that
moves a marker between the SDK's overlay layers, and the `textLabel` branch already sets
`100000` there.

Selection reaches `MapOverlayLayer` as a **prop from `CampusScreen`**, not a store subscription of
its own — one subscription instead of eight — and the `placeDot` branch is a memoised `PlaceMarker`
so a tap re-renders the two markers whose selection changed rather than all ~100.

### 6.2 Density levers, in order

1. **the dot** (§6.1) — roughly 60% less screen area per marker than a teardrop
2. `isHideCollidedCaptions` — already used by the `textLabel` and `placeDot` branches of `MapOverlayLayer`
3. **the caption line budget** (§6.4) — a narrower caption collides with fewer neighbours, and a
   collision here hides the whole label rather than shortening it, so wrapping puts *more* names on
   screen rather than fewer
4. **the collision ladder** (§6.3)

`isHideCollidedMarkers` is the unused next rung, and it is the one that matches the actual failure:
screen-space overlap between DISTINCT coordinates, which the ladder does not address at all. It
hides *other* markers colliding with whichever marker carries the flag, so the selected marker needs
`isForceShowIcon` to be safe from it. What it cannot give is a **count** — only clustering can, and
clustering cannot give captions, tint, `zIndex`, anchor or a selected state, because a cluster leaf
accepts only `identifier`, `latitude`, `longitude`, `image`, `width` and `height` and Naver's default
leaf updater resets `captionText` to `""` on every pass. The two are mutually exclusive on the same
markers.

### 6.3 One pin per coordinate

A coordinate is shared for exactly one reason on this map: a spot is used by different occupants at
different times. The west strip is booths from 11:00 and bars from 18:00, and `daybooth-01` shares
its point with two bars because it is the same stall re-striped at dusk.

The server drops, merges and clock-filters nothing — it ships every place with what the client needs
to disambiguate. `resolvePinCollisions` (`packages/shared/src/map/pins.ts`) picks the pin:

0. **is the selected place** (only while one is selected)
1. **open right now**
2. tie → highest `pinPriority`
3. tie → next opening soonest
4. tie → lowest `order`, then `id`

**Step 0 answers a different question from the rest, which is why it outranks them.** Steps 1-4 ask
who best represents a spot right now; step 0 asks which spot the user just asked about. Without it,
selecting a suppressed place from the list flies the camera to a coordinate carrying somebody else's
marker while the peek sheet names a place that is not drawn — survivable when every marker was a
pin, and glaring now that the selected one is the only pin on the map (§6.1). It cannot tie, since
at most one marker matches, so it is exempt from the totality argument below. It matches on `id`
rather than `tap.placeId`, which keeps `PinCandidate` minimal: the two are the same string for an
event marker, and only event layers are ever collision peers.

**Openness comes first among the rest, and the order is load-bearing.** Only step 1 knows about the re-striping.
With `pinPriority` first the operations desk would spend its entire 11:00–18:00 window hidden behind
a bar that is shut, because `bar` outranks `booth` on a number that cannot see the clock.

Step 4 makes the order **total**, which matters more than it looks: a tie makes the winner depend on
input order, the input is re-derived at every clock boundary, and the result is a pin swapping
identity underneath someone who is looking at it.

**A suppressed place keeps its list row.** The ladder answers which pin is drawn at a point, not
whether a place exists — which is why selection (§4) and collision live in different modules.

> [!IMPORTANT]
> **Scope it to the festival layers, never to a whole endpoint response.** The two building layers
> draw one building twice on purpose — a number and a name at one coordinate, from records carrying
> the same `id` — and they arrive in one `/map/overlays/campus` response. Run the ladder over them and
> every tie falls through to an identical `id`, suppressing one of the two at random. `CampusScreen`
> passes `MapOverlayLayer` a `collisionPeers` set built from `isFestivalLayer` plus current
> visibility. The second half matters too: a hidden 주점 must not suppress a visible 부스 and leave a <!-- conventions:allow-korean: the layer labels the app shows -->
> hole where the booth should be.

This replaced `stackKey`, which existed because several sessions collapsed onto one plot and a tap
could not say which was meant. A place is one document now and `tap.placeId` is its own id, so two
booths sharing a spot are two taps and the peek sheet shows one place.

### 6.4 The caption is wrapped in JS, and the native wrapper is switched off

A caption is capped at two lines — 14 display columns for `textLabel`, 16 for `placeDot`, where a
Hangul syllable counts as 2. `wrapMarkerLabel` (`packages/shared/src/map/text.ts`) inserts the
breaks and ellipsizes the overflow before the string reaches `caption.text`, and both branches pass
`requestedWidth: 0`, the SDK's "do not auto-wrap".

**Why not the SDK's own `requestedWidth`,** which exists for exactly this. Two reasons, and the
second is the one that closes the door:

1. It was already set, to `200`, and had never once fired. That is dp on Android and points on iOS,
   while the longest booth title renders at about 157dp at `captionTextSize: 9` — the knob sat above
   every label it governed.
2. Lowering it would still not be enough. The SDK's own documentation on the prop says the caption
   breaks at a suitable position **unless the text is written with no spaces at all**. The native
   wrapper is whitespace-seeking, and the labels that most need breaking are Korean compounds with
   no whitespace in them. 올림픽기념국민생활관 is 20 columns and zero spaces, and 자연과학캠퍼스학생회관 is 22 and zero. <!-- conventions:allow-korean: the building names the app draws -->
   27 of the 61 booth titles likewise carry no space.

So the break opportunities have to be in the string. That is the only lever the native side offers,
because these captions are the SDK's **native** `caption` prop rather than a React `<Text>` —
`numberOfLines` does not exist on them, and re-drawing them as custom views would re-enter the
Android bitmap-snapshot race across ~137 buildings and ~100 booths at once (§6, and
[android-naver-map-markers.md](android-naver-map-markers.md)).

Two things about the implementation are worth knowing before changing it:

- **The fill is `wrap-ansi` and the width model is `string-width`.** Neither is reimplemented.
  What is ours is that `wrap-ansi` is called *twice* — soft first, then hard on only those lines
  that still overflow and also carry a wide character. One pass is wrong in both directions: soft
  alone leaves a space-free Korean compound on one line, which is the native failure above, and hard
  alone splits `International` down the middle. A pure-Latin line over the cap is left to overflow,
  which is what CJK line breaking prescribes.
- **The two column caps are swept values, not preferences.** At 14 and 16 no wrap leaves a
  one-syllable widow on the second line, so no line-balancing code has to exist. Retune the constant
  before reaching for an algorithm.

## 7. Actions and the map scheme

### 7.1 The action union

A sheet button carries one action. The app renders it; it never interprets what the action *means*.

| `actionType` | Handling | Status |
| --- | --- | --- |
| `content` | Render inline in the sheet, no navigation | **new** |
| `route` | `router.push(actionValue)`; a bare `/` is intercepted as `router.dismissTo('/(tabs)/home')` | exists |
| `webview` | `openWebView({url, title})` → `router.push('/webview', {url, title})` | exists — pages on `WEBVIEW_ORIGIN` only |
| `external` | The **same** in-app `/webview` shell; a non-web scheme (`mailto:`, `tel:`) hands off to `Linking.openURL` | exists |
| `miniapp` | `openMiniAppById(id, path)` — the registered mini app's shell, at that page | §7.3 |
| `map` | `openMapAtPlace(ref)` — close any shell on top, open that place's sheet; value is the §7.2 `?place=` grammar | §7.2 |

`webview` and `external` are one code path in `handleSduiAction`, and `webviewColor` is accepted
but never read. They stay distinct action types because the server still emits both and older
clients treat them differently; on this side the only difference is whether a title came along.
What a loaded page may do is decided by its origin, not by the verb that opened it — so the
`external` row is not a weaker security posture, it is the same gate reached by a second name.

Three of the five predated Phase 3 in `packages/shared/src/types/sdui.ts`; the work was `content`
plus the parser cleanup, and all of it has shipped. `parseActionType` returns `'unknown'` for
unrecognized values, `handleSduiAction` no-ops it, and both `renderer.tsx` and the action handler
now carry a `never` exhaustiveness guard.

> The 2026 ESKARA pages live on their own origin, `eskara.miniapp.skkuverse.com`, which the server
> refuses as a `webview` value, so a map button into them is a **`miniapp`** action
> (`eskara-2026/eskara/<page>`, §7.3) and opens inside the mini app shell. Both shells run the same
> bridge gate: `handleMessage` re-resolves
> `resolveWebviewCapabilities(event.nativeEvent.url, getBridgeOrigins())` **per message**, against
> the document that actually posted it rather than once at open time, so a page's `web:open-url`
> and `web:action` behave the same in either shell
> ([ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md) §9). The way back — a page
> opening the map on a place — is a `map` action sent as `web:action`; the runbook is
> [add-view-on-map-button.md](../how-to/add-view-on-map-button.md).

`content` is handled by the sheet that renders the button, not by `handleSduiAction` — that
dispatcher is fire-and-forget and has no surface to render prose into. `unknown` renders no button at
all: the parser keeps it for contract fidelity, but a button that does nothing is worse than a
missing one. A `miniapp` pill leads with the mini app's registry logo instead of the link glyph, so it
reads as "opens inside skkuverse"; the parser drops a `miniapp` action whose value is not a target.

**The peek sheet dismisses itself before it navigates.** `usePlaceNavigate`
(`apps/mobile/src/features/eventmap/place/navigate.ts`) calls
`useBottomSheetModal().dismiss()` and only then `handleSduiAction`. This is not polish; without it
the destination arrives damaged.

A `BottomSheetModal` does not live in the screen that rendered it. `@gorhom/portal` mounts the host
as a sibling that **follows** `children` inside `BottomSheetModalProvider`, and that provider wraps
the root `<Stack>` in `app/_layout.tsx`. The sheet is therefore outside the navigator and painted
after it, so a pushed `/webview` slides in **underneath** and lands with its lower half covered.
Nothing on the pushing side can correct that; the sheet has to go first.

**It comes back, though.** Going and not returning was the first version and it read as losing your
place: back from the webview landed on a bare map. The dismiss is byte-for-byte the user's own, so
the button announces the round trip in advance — `onNavigateAway`, which raises two refs in
`CampusScreen`. One tells `handlePeekDismiss` to keep `selectedPlaceId` and skip `releaseSheet()`,
so the campus sheet stays down and the restored sheet is not stacked on it; the other is consumed by
a `useFocusEffect` that re-presents through `presentOverSheet`. Three things make that cheap:
`/webview` is a card push on the ROOT stack, so `CampusScreen` blurs rather than unmounts;
`selectedPlaceId` is in-memory-only store state that survives a push but not a cold start; and
`requestHandoff` already answers a request made while the campus sheet is closed by presenting at
once and preserving `restoreTo`.

Both refs are raised together at the button rather than chained, because `onDismiss` does not fire
until the close animation ends and that is not guaranteed to precede the return focus. The sheet
returns at its low detent — restoring the exact one needs gorhom's private `minimize()`/`restore()`,
which is a separate question. And an action whose URL is not web (`mailto:`, `tel:`) goes to
`Linking.openURL` instead of pushing, so no focus event arrives and the arm survives until some
later unrelated focus; the fix for that is for `openWebView` to report whether it navigated.

The same constraint is why `BuildingDetailSheet` dismisses before pushing `/map/hssc`, and why
`NoticeDetailScreen`'s original-notice link hands off to the system browser rather than pushing.

Dismissing rather than minimising-and-restoring is also the behaviour wanted here: `onDismiss`
clears `selectedStackKey` (§8), so backing out of the web view lands on the plain campus map instead
of a sheet the user already navigated away from. It pairs with `stackBehavior="replace"`, which
stops the default `'switch'` from resurrecting `BuildingDetailSheet` underneath.

### 7.2 Universal map scheme

A place reference, `[<kind>:]<placeId>`, is parsed by `parseMapPlaceRef`
(`packages/shared/src/map/place-ref.ts`) wherever it arrives: this link, and a `map` action,
including a first-party page's `web:action` "view on map" button (ADR 0006 §9). A page can reach
the map ONLY that way — never through `web:open-url` to this scheme, which would stack a second
copy of the tabs on top of the web shell instead of replacing it.

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

### 7.3 The `miniapp` action — a mini-app target

`actionValue` is a **mini-app target**, one grammar for the map action, a mini-app push's
`miniapp` action, and the `/m/<target>` deep link (`packages/shared/src/miniapps/target.ts`, mirrored by
the server's `src/miniapps/miniapp-target.ts`):

```text
<miniAppId>[<root-relative path>]
eskara-2026                     the mini app at its registered startUrl
eskara-2026/eskara/wristband    that page, inside the mini-app shell
```

An id and a path rather than a URL: an origin does not name a mini app (one host can serve several),
and the shell needs the id for the name, logo and verified badge it frames the page with.

The shell resolves the path against the registry `startUrl`, **failing closed on origin**
(`resolveMiniAppUrl`):

```ts
const resolved = new URL(path, base);
// new URL('//evil.com/x', 'https://a.com') → 'https://evil.com/x'.
// Without this a deep link escapes the registered origin and renders arbitrary
// content inside a shell that shows the verified badge.
return resolved.origin === base.origin ? resolved.toString() : startUrl;
```

- The grammar already refuses `//…` and `/\…`, and the server refuses them before it ships a value.
  The origin check is repeated in the shell because a deep link never passes the server.
- The native side validates the *origin*, never the path — the page list is a mini-app-owned contract.
- `startUrl` stays the mini app's home; `path` only chooses the first page loaded.

## 8. State

`useEventMapStore` (Zustand) holds one thing, `selectedPlaceId` — which place's peek sheet is open.

**Not persisted.** A peek sheet reopening on cold start, for a booth tapped yesterday, is never right.
The store used to persist a sort and the layer set it was keyed to; the list has one order now (§4.2),
so both went with it. Installs that ran an older build keep a stale `eventmap` key in MMKV that
nothing reads.

Its one writer, `setSelectedPlaceId`, is a user gesture, and that is a constraint rather than a
coincidence: a write here re-renders every consumer. Nothing on a polling cadence belongs in this
store. The clock offset used to be written on every manifest poll, which re-rendered `CampusScreen`
for the whole of an event without changing a single derived value.

**Layer visibility is not here.** Festival layers are ordinary `/map/config` layers, so their
visibility lives in `useMapLayerStore` with every other layer's — ephemeral, seeded by nothing at
all, holding only the user's own `overrides` and a transient `chip` (§5.4). Two stores: that one is
the map's, this one is the event's.

### 8.1 `basemapOverride` is gone

The snapshot used to name base-map layers the event forced to a visibility — in practice one boolean,
hiding the building numbers while the festival ran. It is gone on both sides, and an event layer is
an ordinary layer with no way to reach across and change another's.

The removal is worth recording rather than just doing, because the cost was not the field. It was
that a cross-cutting override is a **resolution rule** every reader has to implement identically:
`FilterSheet` implemented two tiers of the three and so reported the building-number layer ON while
the map drew nothing. The chain is four tiers again today (§5.4) and that is survivable for the same
reason it was not then: it lives in `isLayerVisible` and no caller reproduces it. If a festival wants
the building numbers off, that is a `/map/config` `defaultVisibleWhen` question.

## 9. The client festival gate

Because the map is fully server-driven, **opening an activation window on the server is a remote
change to what every installed copy renders**: `/map/config` begins serving festival layers and
chips, and `/eventmap/manifest` begins pointing at a live snapshot. Nothing in the app asks to be
shown a festival — it draws what it is handed. The gate is the switch that decides whether it may be
handed one, so that opening the server and revealing the festival stay two separate acts.

### 9.1 The discriminator is `chipGroupId`

No new wire field. `chipGroupId` already splits the served layers along exactly the line that
matters, because a chip group is a festival-shaped idea to begin with:

| layer | `chipGroupId` | endpoint |
| --- | --- | --- |
| `building_numbers`, `building_labels` | `null` | `/map/overlays/campus` |
| `eskara26_*` | `'eskara-2026'` | `/map/overlays/event` |

Keyed on `chipGroupId` rather than on `endpoint === '/map/overlays/event'`, for the reason `MapLayerDef.chipGroupId`
gives where it is declared: `endpoint` is a cache key, so merging or splitting a route for network
reasons would silently move the gate's boundary, and the symptom would have no line of code to
blame.

### 9.2 One strip closes everything

`withoutFestival` removes every layer carrying a `chipGroupId`, and every downstream surface follows
from that one edit:

| Removed | Because |
| --- | --- |
| The filter tiles and the chip row | Both render straight off `mapConfig.layers` / `.chips` |
| The pins | `MapOverlayLayer` mounts per visible layer, and there is no festival layer to mount |
| The `/map/overlays/event` request | `CampusScreen` reads the endpoint off `layers.find(isFestivalLayer)`, which is now `undefined`, so the query is disabled |
| The list, the peek sheet, the `?place=` deep link | All three read that same query. No markers, no places, nothing to open |

This used to take two gates, because the event map was a second request with a manifest of its own
and `stacksByPlaceId` would still answer a `?place=` link with the config gated. Collapsing the
snapshot tier collapsed the gate with it: **one predicate, one application point, and no second
channel to remember.**

### 9.3 Two rules that fail closed

**Every chip goes, not the subset naming a stripped layer.** A `focus` chip may carry an empty
`layerIds` — that is the spelling for camera-only — so a reference-based filter would keep it, and it
would fly the camera to an empty festival ground. Every chip the server serves today is
festival-scoped, so this costs nothing. The day a chip outlives an activation, this rule needs
refining rather than reusing.

**`Updates.channel === 'beta'`, not `!== 'production'`.** An empty or unexpected channel in a release
build stays shut. Same spelling as the dev-menu gate in `SettingsScreen`. The consequence worth
knowing: the beta channel is unlocked with no flip, so **TestFlight sees the festival the moment the
server opens the window**.

### 9.4 Where it lives, and how it is flipped

| File | What |
| --- | --- |
| `packages/shared/src/types/map.ts` | the unified overlay schema — `MapOverlay` (the `kind`-tagged union), `LatLng`, `I18nText`, `TimeWindow`, `MarkerField`, `MarkerAction` — plus `DailyWindow` and `LayerDefaultVisibility` (§5.4) |
| `packages/shared/src/map/geometry.ts` | `toLatLng`, the one `[lng, lat]` read, and `overlayAnchor`, the single point a camera flies to for any kind |
| `apps/mobile/src/features/map/utils/overlayGeometry.ts` | the SDK's spelling and its ring winding, kept out of shared because both are one library's convention |
| `packages/shared/src/map/parser.ts` | tolerant parse of the marker wire (§3), and the unreadable-declaration policy (§5.4) |
| `packages/shared/src/map/window.ts` | `isOpenNow`, `nextOpeningAfter`, `nextWindowBoundaryAfter` — absolute instants (§5) |
| `packages/shared/src/map/daily-window.ts` | `kstMinutesOfDay`, `isDailyWindowOpen`, `nextDailyBoundaryAfter` — recurring KST wall-clock (§5.4) |
| `packages/shared/src/map/pins.ts` | `resolvePinCollisions` — the coordinate ladder (§6.3) |
| `packages/shared/src/map/list.ts` | `selectVisibleMarkers` (§4.1), `sortPlaces` (§4.2) |
| `packages/shared/src/map/text.ts` | `pickI18nText` — the one place a language is chosen |
| `packages/shared/src/map/chips.ts` | `isLayerVisible` (the four tiers, §5.4), `defaultVisibleAt`, and the chip rules the list borrows (§4.1) |
| `packages/shared/src/store/map.ts` | `overrides` and the transient `chip` — what the user expressed, and nothing else (§5.4) |
| `packages/shared/src/map/festival.ts` | `withoutFestival` — the client festival gate's pure half (§9) |
| `packages/shared/src/hooks/useWindowClock.ts` | the boundary timer that makes 18:00 observable, for both axes (§5.3, §5.4) |
| `packages/shared/src/hooks/useMapLayers.ts` | the one marker query, keyed on the endpoint (§2) |
| `packages/shared/src/store/eventmap.ts` | client state (§8) |
| `apps/mobile/src/features/map/festivalGate.ts` | `isFestivalUnlocked()` — what decides whether the gate is open (§9) |
| `apps/mobile/src/features/eventmap/PlaceCard.tsx` | the list row's layout |
| `apps/mobile/src/features/eventmap/EventListPanel.tsx` | the list, in the campus sheet |
| `apps/mobile/src/features/eventmap/EventMapPeekSheet.tsx` | one place's sheet: chrome, height and the card clip (§10) |
| `apps/mobile/src/features/eventmap/place/` | the sheet: summary, facts card, and `PlaceBlocks` for the composed body (§10) |
| `packages/shared/src/map/placeDetail.ts` | `placeSections`, `highlightBlock` — the sheet's decisions (§10) |
| `packages/shared/src/map/kst-format.ts` | the dated KST strings every row and the sheet show (§5.2) |
| `packages/shared/src/hooks/usePlaceDetails.ts` | every place's detail from `/map/overlays/event/details`, parsed by `parsePlaceDetails` (§10.3) |
| `apps/mobile/src/lib/pending-map-place-link.ts` | deferred deep-link intent (§7.2) |
| `apps/mobile/src/features/map/CampusScreen.tsx` | routes marker taps on `tap.kind`, owns the gate and the collision peer set, swaps the sheet body, resolves place links |
| `apps/mobile/src/features/map/components/MapOverlayLayer.tsx` | draws every `/map/config` layer, booth pins included; dispatches on each overlay's `kind`; applies the ladder to markers alone |
| `apps/mobile/src/features/map/components/MapZoneOverlay.tsx` | one `kind: "polygon"` overlay |
| `apps/mobile/src/features/map/components/MapRouteOverlay.tsx` | one `kind: "path"` overlay |

> [!IMPORTANT]
> **Everything the festival shows comes from `/map/config` and its layers' `endpoint`.** The server
> serves booths as ordinary `placeDot` marker layers on `/map/overlays/event`, each carrying its own
> `subtitle`, `hours`, `fields`, `actions` and `tap: { kind: 'event', placeId }` — so `MapOverlayLayer`
> draws them like any other layer and the list and peek sheet render the same objects. The chips over
> the map are `/map/config`'s too, carrying an action and a layer set rather than a predicate. See
> [map-config-api-spec.md](../reference/map-config-api-spec.md). The marker contract is
> `skkuverse-server/docs/reference/map-markers-api.md`, and how a place is stored and switched on is
> `skkuverse-server/docs/reference/event-places.md`.

`CampusNaverMap` needed **no change** through any of this — it forwards `children` verbatim into
`NaverMapView`, and no phase has needed a new map-level prop.

## 10. The place sheet

The sheet is a **structured head** every place shares and a **body the operator composes**.

```text
[pinned]  title
status    open now · closes 10/1(Thu) 23:00   statusLineOf
meta      <locationLabel> · <org, or the overlay's subtitle>
highlight the first list or table block, lifted above the fold
photos    the body's first run of consecutive images, one rail
─ collapsed card ends about here ─
facts     location · hours · instagram · links · notices
blocks    text · list · table · image · notice, in the authored order
```

**The facts card is the floor, and it is always mounted.** `placeSections` returns `['facts']` for a
place with no detail at all, which is most of what the server serves — every one of them carries
`hours` on the overlay wire, and gating the card away took their opening times with it. Only
`locationLabel` fills the location row. The wire's `subtitle` is whatever ops wrote — a bay number,
a kind and a day, an operating note, a shuttle route — so half the bars would read
"location: 연합 주점". <!-- conventions:allow-korean: the subtitle ops authored, quoted -->
It belongs in the meta line instead, where every one of those readings is correct.

### 10.1 Why the body is blocks

The council's requirement sheet names twelve categories whose bodies share almost nothing: a booth
wants an introduction and a list of games, a goods shop wants an item/price table plus payment and
pickup instructions, a barrier-free zone wants three prose paragraphs, a toilet wants nothing. A
typed field per category means a client release every time ops needs a shape the app has not shipped.

So `PlaceDetail.blocks` is an ordered list of five types — `text`, `list`, `table`, `image`,
`notice` — and a new category becomes an authoring change. `MapPlaceDoc` grows one field rather than
ten. The wire already had a primitive form of this: a `content` MarkerAction carries free text
(`daybooth-01`'s reward explainer).

Three rules are load-bearing:

- **`type` is an OPEN enum.** An unknown block is dropped on its own, and the switch in
  `place/PlaceBlocks.tsx` deliberately has no exhaustive `never` arm — one would blank a whole body
  on an older build the day a sixth type ships. Same discipline as `OVERLAY_KINDS`.
- **Style belongs to the type, not the block.** The operator picks which blocks and in what order,
  never how they look. A per-block styling knob multiplies the design surface by every place.
- **The highlight is the first `list` or `table`** (`highlightBlock`), so the operator chooses what
  the collapsed card leads with by ordering their blocks. That replaced a per-kind fallback table;
  nothing branches rendering on `PlaceKind` any more. The kind is kept for the list's filters.

**Consecutive images are one rail** (`placeBody` in `packages/shared/src/map/placeDetail.ts`). A food
truck is a menu table and then one photo per dish, captioned with the dish's name; drawn a block at a
time that was a stack of one-photo rails, and the viewer opened each alone. Folded, it is one rail the
viewer pages across. The summary draws the body's first rail (`heroGallery`) and the body skips it by
id. Only adjacency folds, so a logo above an introduction stays a rail of one where the operator put
it.

Anything genuinely long-form stays a **link out** rather than an embed: `goods-shop` and `preorder`
already carry a goods-guide `webview` action to `webview.skkuverse.com/eskara/goods`. A web view inside the
sheet would bring a second scroller into the one slot gorhom allows (§"a gorhom scrollable cannot
nest inside another"), report its height only after first paint, and load once per pin on the worst
network day of the year.

### 10.2 The collapsed card is one size

Every place opens at SDS's `small` detent, however short its content. The card used to shrink to fit
a short place, so a toilet opened as a sliver and a food truck as a full card, and one kind of sheet
at two heights read as two different sheets. A short place now leaves glass below its content
instead. The summary carries no minimum height and nothing reads the detent, which is what
`docs/explanation/bottom-sheet-system.md` rules out.

The content is still clipped to the card (`SheetCardClip.tsx`): gorhom lays the body out as tall as
the top detent, so a summary that fills the card to its edge would otherwise draw over the map.

### 10.3 Where the data comes from

`GET /map/overlays/event/details` serves every place's detail in one response, keyed by the overlay's
`tap.placeId`. The contract is skkuverse-server `docs/reference/map-overlays-api.md` §5.4, and the
server mirrors `PlaceDetail` one-to-one. A separate route rather than a field on the overlay, because
only the sheet reads it.

`usePlaceDetails` fetches it once, beside the overlays, so a tapped pin's sheet opens with its menu
already there instead of drawing its skeleton and growing under the finger. The route is the festival
layer's endpoint plus `/details`, and a `null` endpoint disables the query — so the festival gate
closes the details with the overlays and no second guard. `CampusScreen` looks the selected place up
and passes `detail` down as a prop, the same way it passes `place`.

`parsePlaceDetails` (`map/parser.ts`) fails as narrowly as the server does: a bad row, block or
action drops alone, and a detail drops whole only without an id or with a `kind` outside
`PLACE_KINDS`, which is closed where a block's `type` is open. A failed request, or a place with no
detail, is the overlay alone: hours and actions, with the `subtitle` on the meta line.

## 11. Gotchas

- **Coordinate order — one conversion, and only one.** The wire is GeoJSON: `geometry.coordinates`
  is `[lng, lat]`, positional, and the server converts nothing. `toLatLng`
  (`packages/shared/src/map/geometry.ts`) is the single place that reads the tuple, and everything
  downstream sees a named `{ lat, lng }`. Swapped Seoul coordinates land in the ocean and **never
  throw**, so a second conversion anywhere is a second chance to introduce a bug that reports
  success. The `PolylineCoord` this replaced was `[lat, lng]` — the same shape as a GeoJSON position
  with the opposite meaning, which is why the replacement is a named object rather than a tuple.
- **Polygon rings are reversed unconditionally, and the proof is a tap.** The wire is wound per RFC
  7946 (exterior CCW) and Naver wants the opposite. A wrongly wound ring frequently still *draws* and
  merely refuses events, so a screenshot cannot tell the two apart — pressing the zone can. See
  `apps/mobile/src/features/map/utils/overlayGeometry.ts`.
- **Never run the collision ladder over a whole endpoint response.** The two building layers draw one
  building twice on purpose, from records sharing an `id`, so every tie-break falls through to an
  identical value and one of the pair is suppressed at random. Scope it with `collisionPeers` (§6.3).
- **`hours: []` is ALWAYS OPEN, never "unknown".** Every place with no window — a 화장실, and also a <!-- conventions:allow-korean: the place category the app shows -->
  place whose every window failed to parse — reads as open. That direction is deliberate: an ops typo
  shows a booth permanently open, which somebody notices and reports, rather than one that silently
  vanishes.
- **`parseActionType` unknown → `'unknown'` is live for ALL SDUI**, not only the event map. A section
  with a typo'd `actionType` used to be handed to the webview opener and now does nothing. That is
  the intended direction — the failure mode of not understanding an action should not be to open it —
  but it reads as a regression in QA unless you know.
- **`@mj-studio/react-native-naver-map` is pinned exact, and the pin is the point.** The version
  lives in `apps/mobile/package.json`. A newer release can bump the native Naver SDK, which would
  need `expo prebuild --clean` plus a manual `runtimeVersion` bump — a caret would let an ordinary
  install pull that in with neither. Our nil-icon patch is gone: the fix went upstream as PR #184,
  whose version restores `alpha` unconditionally and guards only the `iconImage` assignment. Ours
  guarded both, so a failed image load left the marker permanently invisible. The floor is 2.8.0,
  the release that moved the iOS image loader off `RCTImageLoader` so every completion lands on the
  main queue; below it, `imageCache` is written from a background queue while the main thread reads
  it, over-releasing `NMFOverlayImage` — see spencer0124/skkuverse#53.
- **`useMapConfig` must keep its never-throw fallback.** It is now the ONLY thing standing between a
  config hiccup and a festival that does not exist: the endpoint the booths arrive on is read off its
  layers, so a thrown config is a blank event map as well as a blank filter sheet. The offline
  fallback (`DEFAULT_MAP_CONFIG`) deliberately carries no festival layers, which is the honest answer
  — it cannot know whether an activation is open.

## 12. Related

- [ADR 0004 — event map layer ownership](https://github.com/spencer0124/skkuverse/blob/main/docs/decisions/0004-event-map-layer-ownership.md)
- [Server marker contract](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/map-markers-api.md) — the shared marker schema and the `/map/*` routes
- [Server event places](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/event-places.md) — how a place is stored, authored and switched on
- [Implementation plan — skkuverse#11](https://github.com/spencer0124/skkuverse/issues/11)
- [Android Naver map markers](android-naver-map-markers.md) — the bitmap-snapshot race `MapOverlayLayer` avoids
- [App ADR 0006 — mini-app webview & push architecture](../decisions/0006-miniapp-webview-push-architecture.md)
- [App ADR 0007 — status derives against the device clock](../decisions/0007-device-clock-event-map-status.md) — the reasoning behind §5.2
- [App ADR 0002 — no notification inbox](../decisions/0002-no-notification-inbox.md) — amended by the event map inbox. *(Distinct from umbrella ADR 0002, pull-based config contracts.)*
