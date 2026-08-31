---
title: Map Config API Specification
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-31
audience: public
---

# Map Config API Specification

> The server-driven map layer contract, centred on `GET /map/config`. Read this before adding or changing a map layer, on either the server or the client.

## Summary

The `/map/config` system replaces hardcoded campus markers and scattered bus route overlay
logic with one server-driven layer registry. The client fetches the layer definitions at
startup and renders the filter UI from them. Each layer's own data loads lazily, when it is
first needed.

| Endpoint | Purpose |
| --- | --- |
| `GET /map/config` | The layer registry, the campus definitions, the chips and the camera defaults |
| `GET /map/markers/campus` | Every building marker, for both building layers |
| `GET /map/markers/event` | Every published booth of the live festival, for every event layer |
| The `endpoint` value of a layer | Polyline coordinate data |

Every response uses the v2 envelope format, `{ meta, data }`.

> [!IMPORTANT]
> **Layers share endpoints, and the client MUST filter by `layerId`.** One route serves one
> data source, not one layer: both building layers read `/map/markers/campus`, every event
> layer reads `/map/markers/event`. The marker cache is keyed on the endpoint string, so
> layers sharing a URL cost one fetch between them and each renders
> `markers.filter((m) => m.layerId === layer.id)`. Without that filter every layer draws the
> whole response — which is exactly how both building layers came to draw all 137 buildings
> each, with every number colliding with its name.
>
> The wire schema below is mirrored from the server, whose
> `src/map/map-marker.types.ts` is the SSOT and whose
> [`docs/reference/map-markers-api.md`](https://github.com/spencer0124/skkuverse-server/blob/main/docs/reference/map-markers-api.md)
> is the prose contract. Prefer those when the two disagree.

## `GET /map/config`: the layer registry, campuses, chips and camera defaults

Returns the campus definitions, the available map layers, the chips that act on
them, and the camera settings the app applies to moves it makes on its own.

### Request headers

| Header | Value | Required | Description |
| --- | --- | --- | --- |
| `Accept-Language` | `ko` \| `en` \| `zh` | No | Locale, defaulting to `ko` |
| `If-None-Match` | A previous ETag | No | Conditional request for cache validation |

### Response headers (required)

| Header | Description |
| --- | --- |
| `ETag` | An opaque string, such as a content hash or `"{version}:{timestamp}"` |
| `Vary: Accept-Language` | Makes caches and CDNs keep a separate copy per locale |

### Response (200)

```jsonc
{
  "meta": {},
  "data": {
    "campuses": [
      {
        "id": "hssc",
        "label": "인사캠", // conventions:allow-korean: live server payload
        "centerLat": 37.587241,
        "centerLng": 126.992858,
        "defaultZoom": 15.8,
        "radiusM": 1000
      },
      {
        "id": "nsc",
        "label": "자과캠", // conventions:allow-korean: live server payload
        "centerLat": 37.293580,
        "centerLng": 126.974942,
        "defaultZoom": 15.8,
        "radiusM": 1000
      }
    ],
    "layers": [
      {
        "id": "building_numbers",
        "type": "marker",
        "markerStyle": "numberCircle",
        "label": "건물번호", // conventions:allow-korean: live server payload
        "defaultVisibleWhen": { "kind": "always" },
        "userConfigurable": true,
        "endpoint": "/map/markers/campus",
        "chipGroupId": null,
        "style": { "size": 16 }
      },
      {
        "id": "eskara26_bar",
        "type": "marker",
        "markerStyle": "placeDot",
        "label": "주점", // conventions:allow-korean: live server payload
        "defaultVisibleWhen": {
          "kind": "scheduled",
          "windows": [{ "start": "18:00", "end": "00:00" }]
        },
        "userConfigurable": true,
        "endpoint": "/map/markers/event",
        "chipGroupId": "eskara-2026",
        "style": { "color": "F04452", "width": 22, "height": 30, "captionTextSize": 9 }
      }
    ],
    "chips": [
      {
        "id": "eskara26_view_bar",
        "label": "주점", // conventions:allow-korean: live server payload
        "icon": { "kind": "emoji", "emoji": "🍺" },
        "action": {
          "kind": "focus",
          "camera": {
            "lat": 37.295129,
            "lng": 126.971234,
            "zoom": 17.5,
            "tilt": 0,
            "bearing": 0,
            "durationMs": 500
          },
          "layerIds": ["eskara26_bar"]
        }
      }
    ],
    "cameraDefaults": {
      "markerFocus": { "zoom": 17.5, "tilt": 0, "bearing": 0, "durationMs": 500 },
      "campusFocus": { "durationMs": 500 }
    }
  }
}
```

> [!NOTE]
> The sample is abridged — the live response carries a second building layer and, only while an
> activation window is open, the festival's layers and chips. The chips begin with a reset chip the
> server synthesises as `<layerSetId>_all`, labelled with the festival's name and naming its
> default-visible layers, followed by the ones the festival config authors. It matched
> `GET /map/config` as of 2026-08-29.
> The authority is the server's `src/map/map-config.data.ts`. An earlier revision of this
> document described a single `campus_buildings` layer and `bus_route_*` polylines, neither of
> which exists: the polylines are commented out on the server. The old
> `?overlay=number|label` query is gone — a server still receiving it ignores it, but sending
> it splits one marker cache entry into two.
>
> The `//` comments mark Korean that is live payload, for the conventions linter. They are
> not part of the response.
>
> **Building numbers and building names being separate layers is part of the contract.**
> The split is what lets a user keep the names for orientation while turning the numbers off,
> or the reverse — two independent toggles over one set of documents. An earlier revision
> justified it by an event's ability to force the numbers off; that mechanism
> ([`basemapOverride`](../explanation/eventmap-rendering.md)) has been removed, and the split
> stands on its own without it.

### Response (304)

An empty body. The client keeps its cached config.

### Campus fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Campus identifier, `"hssc"` or `"nsc"` |
| `label` | string | Yes | Display name, already localised |
| `centerLat` | number | Yes | Latitude of the campus centre (WGS84) |
| `centerLng` | number | Yes | Longitude of the campus centre (WGS84) |
| `defaultZoom` | number | No | Initial map zoom, defaulting to `15.8` |
| `radiusM` | number | No | How far from the centre still counts as being on this campus, in metres. The client uses it to tell whether the camera and the campus toggle are looking at the same place. Optional in both directions: a server predating it sends nothing, and a client predating it ignores it, so the client keeps its own fallback — see [ADR 0008](../decisions/0008-campus-camera-reconciliation.md) |

### Layer fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique layer identifier, used by the client as a state key |
| `type` | string | Yes | `"marker"` or `"polyline"`. The client ignores a type it does not know |
| `label` | string | Yes | Localised text for the filter UI |
| `markerStyle` | string | No | How a `marker` layer draws: `numberCircle`, `numberDot`, `textLabel` or `placeDot`. An unrecognised value falls back to the number-dot rendering |
| `defaultVisibleWhen` | object | Yes | **When** the layer is on to begin with — see [Default visibility](#default-visibility). Replaced a plain `defaultVisible: boolean`, which could not say that a bar layer belongs to the evening of every festival day |
| `userConfigurable` | boolean | No | **Who** may change that visibility — a separate axis from `defaultVisibleWhen`. An **absent value means `true`** — never fail closed, or a server predating the field would silently strip every toggle off the filter sheet. It governs the affordance, not the capability: a locked layer still renders, still fetches and is still deep-linkable, only its control disappears. Note this fails in the OPPOSITE direction from `defaultVisibleWhen`, and both are right: this one governs an affordance, where failing closed removes the user's only way to act |
| `endpoint` | string | Yes | Where to fetch this layer's markers or coordinates. **Not unique** — see the note in the summary |
| `chipGroupId` | string \| null | Yes | Which exclusivity group a chip may swap this layer within, or `null` for a layer no chip may ever change. See [Chips](#chips) |
| `style` | object | No | Rendering hints — colour and geometry |

### `style` fields

Every member is optional, and the client falls back to the constant it hardcoded before the
field existed — so a server sending none of them renders exactly as one that never had them.

| Field | Type | Applies to | Description |
| --- | --- | --- | --- |
| `color` | string | `placeDot`, `textLabel`, polyline | Six hex digits without a `#`, such as `"2D8C4E"`. The polyline stroke colour, the `placeDot` pin tint, or a caption colour depending on the layer's `markerStyle` |
| `outlineColor` | string | — | Declared, unread |
| `width` / `height` | number | `placeDot` | Pin size in points. Sent together: the tintable base icon has natural proportions, and setting one alone distorts the tint |
| `size` | number | `numberCircle` | Circle diameter in points. The number's glyph is derived from it as a fixed ratio, so the two cannot drift |
| `captionTextSize` | number | `placeDot`, `textLabel` | Caption point size |
| `zIndex` | number | `textLabel` | Draw order against other overlays. The label layer sets it high so a building name is never hidden behind a booth pin |

**The caption's line budget is not on the wire, and is client-owned for now.** How many columns a
caption may fill and how many lines it may take are constants in `MapMarkerLayer`, not `style`
fields — the same place `width`, `height` and `size` lived before they were promoted. They are not
here because they were tuned against real label data rather than chosen, and a server that has never
seen those labels cannot tune them better. Promote them the way the geometry was promoted, if a
layer ever needs its own budget. What the client no longer honours at all is the SDK's own
`requestedWidth`: it is pinned to `0`, because the native wrapper only breaks at whitespace and the
Korean names that need breaking have none. See eventmap-rendering §6.3.

**Colour is deliberately absent from the building layers.** The number circle's fill and the
`placeDot` tint fall back to a design token that resolves per theme, and a hex from the server
cannot. Geometry is theme-independent and belongs on the wire; a colour that comes from a token
does not. The festival layers do send `color`, because a category colour is content rather than
theme.

## Default visibility

`defaultVisibleWhen` is a tagged union, not a boolean beside a schedule:

```ts
interface DailyWindow { start: string; end: string }   // "HH:MM" KST, half-open [start, end)

type LayerDefaultVisibility =
  | { kind: "always" }
  | { kind: "never" }
  | { kind: "scheduled"; windows: DailyWindow[] };     // the server guarantees at least one
```

A pair of `boolean` + window list can hold combinations that mean nothing — `false` with windows is a
contradiction, `true` with windows makes the boolean dead data, and an empty list is a second
spelling of "no schedule". A layer on all day is `{ "kind": "always" }`, which is the one spelling
of that.

**`start > end` wraps past midnight.** 주점 is `{ "start": "18:00", "end": "00:00" }`. <!-- conventions:allow-korean: the layer label the app shows -->
Midnight is `"00:00"` and the server rejects `"24:00"`, so there is one spelling of it.

### Wall-clock here, instants on a marker

A place's `hours` are absolute `TimeWindow` instants describing one booth on one festival day. A
layer's schedule says "주점 belongs to the evening", which is the same sentence every day — <!-- conventions:allow-korean: the layer label the app shows -->
written as instants it would restate the festival's dates in a second file, and a date slip touching
only one of them is silent.

The timezone guarantee is not given up. **The client derives the current minute from the epoch** —
`(Date.now() + 9h) % 86_400_000`, never `Date.getHours()` — so a phone set to New York still flips
주점 on at 18:00 KST. <!-- conventions:allow-korean: the layer label the app shows -->
`Date.now()` is UTC epoch milliseconds and a zone setting only changes how a time is *formatted*.
The fixed +09:00 is exact: Korea has had no DST since 1988. The zone never crosses the wire.

**The server never evaluates it.** Windows ride in the payload and the device does the arithmetic,
which is what keeps this a deterministic response.

### Resolution order on the client

Four tiers, and the schedule is the last resort:

```text
forced ?? chipNarrowing ?? userToggle ?? defaultVisibleAt(layer, now)
```

`forced` is the `userConfigurable: false` case, and it outranks a chip because such a layer is out of
a chip's reach too. Every tier is a **fallback, never an assignment**: writing a resolved value into
storage destroys a preference the user cannot re-express, and — since the last tier moves with the
clock — freezes a schedule the moment it is first read.

### An unreadable declaration is OFF

A `kind` this build cannot resolve, a malformed object, or a `scheduled` whose every window fails to
parse, all become `null` client-side and resolve to hidden. That is the opposite direction from
`userConfigurable`, and both are right: this axis exists to put *less* on screen, so reading a rule
the client cannot understand as "on all day" would draw 주점 at noon the first time a new `kind` <!-- conventions:allow-korean: the layer label the app shows -->
ships. `null` is kept distinct from `{ "kind": "never" }`, which is an authoring choice rather than a
failure.

| Wire | Client answer |
| --- | --- |
| `{ "kind": "always" }` | on |
| `{ "kind": "never" }` | off |
| `scheduled`, at least one window parses | in-window, over the surviving windows |
| `scheduled`, every window fails | off (unreadable) |
| unknown `kind`, malformed, or absent | off (unreadable) |

Two guards stop that becoming a silent failure of its own: an unreadable layer **keeps its
filter-sheet tile**, so a user can still turn it on; and a response in which *no* layer is readable
falls back to the client's bundled `DEFAULT_MAP_CONFIG` rather than drawing an empty campus.

## Chips

A layer answers *what is drawn*. A chip answers *where should I be looking, and what should be on
while I look there*. Chips ship inside this same document, beside `layers`, and the app renders a
pill and dispatches on `action.kind` without interpreting it.

```ts
interface MapCameraMotion { zoom: number; tilt: number; bearing: number; durationMs: number }
interface MapChipCamera extends MapCameraMotion { lat: number; lng: number }

type MapChipAction =
  | { kind: "webview"; url: string }
  | { kind: "focus"; camera: MapChipCamera; layerIds: string[] };

interface MapChip {
  id: string;
  label: string;                                  // already localised
  icon: { kind: "emoji"; emoji: string } | null;
  action: MapChipAction;
  isReset: boolean;                               // true on exactly the synthesised reset chip
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique across the chip list. Reported as the analytics `item_id` |
| `label` | string | Yes | Localised text, and also the header title of a page a `webview` chip opens — there is deliberately no separate `title` |
| `icon` | object \| null | Yes | `null` is declared before it is reachable, so a text-only chip can arrive without a coordinated release. An unrecognised icon kind degrades to `null` rather than dropping the chip |
| `action` | object | Yes | Discriminated on `kind`. A kind the client cannot route **drops the whole chip** |
| `isReset` | boolean | Yes | Does a tap mean **stop narrowing** rather than "show these layers". `false` on every authored chip rather than absent, since an optional field is a second thing to branch on. The client reads only an explicit `true` |

> [!IMPORTANT]
> **`isReset` is on the wire because it stopped being derivable.** The reset chip used to be
> recognisable by comparing what it names against the layers on by default — and with
> `defaultVisibleWhen` that comparison depends on the time of day, so at 19:00 the reset chip no
> longer describes the default view. Reading a reset tap through rule 1 below would set every layer
> it names to on, turning 주점 on at noon: the exact crowding the schedule exists to remove. <!-- conventions:allow-korean: the layer label the app shows -->
> `action.layerIds` still says which GROUP the tap is scoped to; this says what it MEANS within it.

> [!IMPORTANT]
> The drop is deliberate, and is the opposite call from `tap` on a marker. A marker is a *place*
> that also happens to be tappable, so an unroutable one stays drawn and inert; a chip is its
> action, so an unroutable chip is a button that visibly does nothing. A missing button is better
> than a dead one.
>
> A map chip is also not a filter over snapshot items. The event map once shipped chip groups of
> its own, each chip a predicate evaluated client-side; those left the wire with snapshot schema
> v2, and the chips the map shows are these alone — an action and a layer set. What the list in
> the campus sheet shows follows from layer visibility, never from a chip's own state.

### What a chip tap may change — two rules

1. **Only layers sharing the `chipGroupId` of the layers it names.** The chip's `layerIds` resolve
   to one group; every layer in that group is set (named → on, unnamed sibling → off); every layer
   outside it is untouched. An **empty** `layerIds` resolves no group, so the chip moves the camera
   and changes nothing — that is the camera-only chip, and it is why the field is not nullable.
2. **Never a `userConfigurable: false` layer.** A chip tap is a user-initiated change, and that
   flag already answers who may make one. Inert today, since nothing is `false`.

Together these are what let a festival chip swap the festival layers while the building layers stay
visible and stay user-toggleable. Neither "exclusive over everything" nor "purely additive"
does that: the first turns the baseline off, the second cannot give a clean single-purpose view.

The client holds both rules in one place, `packages/shared/src/map/chips.ts`, unit-tested against
the real layer shapes. No call site resolves a group itself.

### `chipGroupId` is declared, never inferred

The tempting shortcut is to read the group off `endpoint` — layers sharing a data source already
share a URL, so today the two agree exactly. It is the wrong key. `endpoint` is a **cache** key, so
merging or splitting a route for network reasons would silently redraw the chip boundaries, and the
symptom would have no line of code to blame. The building layers carry `null`, which is a
meaningful value rather than an omission: an absent field parses to `null` too, so a server
predating it cannot have its base layers swapped out from under the user.

### What the client does with a chip

| Action | Client behaviour |
| --- | --- |
| `webview` | Opens the in-app web view shell at `url`, titled by the chip's `label` |
| `focus`, `isReset: false` | Records the group's narrowing, then moves the camera. The tap is treated as an **explicit request**, so a camera arriving on a different campus switches the campus toggle silently instead of offering the reconciliation card — the same handling a locate press gets ([ADR 0008](../decisions/0008-campus-camera-reconciliation.md)) |
| `focus`, `isReset: true` | Drops the narrowing and moves the camera, changing no layer directly. Every layer in the group falls back to `userToggle ?? defaultVisibleAt` |

Which chip the map is showing is **stored**, as the tap that put it there. It used to be derived by
asking which chip described the layers as they stood, and that could not survive `defaultVisibleWhen`
for two independent reasons: the clear control has to restore what the *user* had, and a past is not
recoverable from a present; and the reset chip stopped being recognisable by comparison at all, since
the default view now depends on the time of day.

Once narrowed, the app replaces the chip row with a strip naming that chip and offering to clear it.
Clearing writes nothing — it drops the shadow — so a layer the user had turned on comes back on, and
a layer they never touched returns to its own schedule rather than to a boolean captured on the way
in. Toggling a tile in the filter sheet also ends the narrowing, committing the visible state first
so nothing else on screen jumps.

## `cameraDefaults`

Camera settings for the moves the app makes on its own, as opposed to the ones a chip asks for.

| Field | Type | Description |
| --- | --- | --- |
| `markerFocus` | `MapCameraMotion` | Focusing a tapped marker, a search result, or a deep link |
| `campusFocus` | `{ durationMs }` | Switching campus. Only the duration: the zoom, tilt and bearing are per-campus and already sit on the campus entry |

These were constants repeated at three call sites in the app, which meant a chip's camera and a
marker-tap camera were configured in two places and could disagree about how close "close" is. The
client falls back member by member, so a partial object cannot produce a `NaN` zoom.

> [!NOTE]
> **A camera cannot be honoured in one call, and that is a client limit rather than a schema one.**
> The Naver SDK's `animateCameraTo` takes a coordinate, a zoom and a duration but not tilt or
> bearing; the declarative `camera` prop carries tilt and bearing and has **no** duration. So a
> camera with `tilt === 0 && bearing === 0` goes through the imperative method and keeps its
> `durationMs`, and any other goes through the prop and animates at the SDK's own pace. The choice
> is made in one place, `apps/mobile/src/features/map/utils/moveCamera.ts`. Every camera served
> today is flat, so nothing takes the second path yet; it exists because the wrong mechanism
> produces a flat camera and no error on either side.

## Marker endpoints

`GET /map/markers/campus` returns **every** building, on both campuses, for **both** building
layers. `GET /map/markers/event` returns every published booth of the live festival, for every
event layer, and an empty list when no activation is open. Both produce the same object.

### The marker schema

```jsonc
{
  "meta": { "lang": "ko" },
  "data": {
    "markers": [
      {
        "id": "2",
        "layerId": "building_numbers",
        "campus": "hssc",
        "lat": 37.587361,
        "lng": 126.994479,
        "text": { "ko": "1", "en": "1" },
        "startAt": null,
        "endAt": null,
        "tap": { "kind": "skku_building", "placeId": "2" }
      }
    ]
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique **within its layer**, NOT across layers. One building is drawn once per building layer and both markers carry the same value, so the client's React key has to be `layerId` plus this |
| `layerId` | string | Yes | Which layer draws this marker. Always one of the ids `/map/config` advertises |
| `campus` | string | Yes | `"hssc"` or `"nsc"`. For a booth this is the **plot's** campus, so a marker's campus and its position cannot disagree |
| `lat` / `lng` | number | Yes | WGS84, un-swapped from Mongo's GeoJSON `[lng, lat]` by the server, which is the only converter |
| `text` | object | Yes | `{ ko, en, zh? }` — the string this marker **displays**: a building number, a building name, or a booth title. The layer's `markerStyle` decides how it is drawn |
| `startAt` / `endAt` | string \| null | Yes | ISO instants bounding when the marker is drawn, `null` for unbounded on that side |
| `tap` | object \| null | Yes | `{ kind, placeId }`, or `null` for a marker that is not interactive |

```ts
type MarkerTap =
  | { kind: 'skku_building'; placeId: string }
  | { kind: 'event'; placeId: string };
```

`placeId` is a **string for every kind**, including a building whose id is numeric in Mongo. One
addressing scheme is the point; the client narrows it back to a number inside its building
branch, where `GET /building/:id` needs one.

`event` names the **kind** of place, not the festival. Next year's markers carry the same kind, and
the client resolves `placeId` against whichever event snapshot is live — so a new festival is a
server config edit, and the client branch is already there.

### `text` ships every language and is not resolved server-side

The two producers hold different sets — a building carries `{ko, en}` only, while an
ops-authored booth title may also carry `zh` — so resolving against `meta.lang` would mean
picking one and discarding the rest. `ko` is always present. `en` falls back to `ko`, and
**missing means the empty string, not `null`**: both writers of the buildings collection
coalesce a missing English name to `""`, so a `??` fallback ships blank labels.

### There is no `status`, deliberately

Visibility is a pure function of the device clock and the two bounds:

```text
(startAt == null || now >= startAt) && (endAt == null || now < endAt)
```

Both `null` therefore means **always visible**, and only that. `status` was a cache of that
arithmetic, and caching it forced both-bounds-null to mean two opposite things depending on a
sibling field — an always-on facility and a cancelled booth. A **cancellation is expressed by
not serving the marker**, which is what frees null/null to mean one thing.

The client owns the consequence: the payload either side of a boundary is byte-identical, so
React Query's structural sharing keeps object identity and nothing re-renders. A timer has to
bump a counter the visibility filter depends on — `useVisibleByWindow` in
`packages/shared/src/hooks/`, over the pure helpers in `packages/shared/src/map/window.ts`.

### Two fields that used to be here

- **`displayNo` folded into `text`.** The two building layers are the same documents differing
  only in which field becomes the visible string.
- **`skkuId` folded into `tap`.** It could only ever address a building.

An earlier revision of this document described a `{ id: "hssc_1", code, name }` shape. That was
never what the client parsed and no longer resembles what the server sends.

## Polyline overlay endpoints

The client expects polyline data at whatever path a layer's `endpoint` names.

```json
{
  "meta": {},
  "data": {
    "coords": [
      [37.587241, 126.992858],
      [37.588000, 126.993000]
    ]
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `coords` | `number[][]` | An ordered array of `[lat, lng]` pairs, at least two |

## Caching

**What actually ships is React Query staleTime, not conditional requests.** An earlier revision
of this section described an `If-None-Match` / `304` flow; grep the app for `If-None-Match` and
there is none, on this endpoint or any other. It was a plan, written as though it were a fact.

| Query | staleTime | Notes |
| --- | --- | --- |
| `['map', 'config']` | 5 min (gc 30 min) | Never throws — falls back to `DEFAULT_MAP_CONFIG` |
| `['map', 'layer', 'markers', endpoint]` | 10 min | Keyed on the endpoint **string**, so layers sharing a URL share one entry |

Server-side `Cache-Control` is the other half and is the server's to state:
`/map/markers/campus` is a day (or `no-store` on its degraded fallback), `/map/markers/event`
is a minute. `/map/config` carries only Express's auto-generated `ETag` and `Vary`.

A silent `eventmap-refresh` push invalidates the marker key prefix and `['map','config']`
(`apps/mobile/src/services/silent-push.ts`), which is the only thing that shortens the marker
staleTime mid-festival. Its honest value is bounded by the server's own 60s TTL, and it does
nothing in the quit state.

## i18n

| Item | Value |
| --- | --- |
| How the locale is chosen | The server reads the `Accept-Language` header |
| Supported locales | `ko` (default), `en`, `zh` |
| Locale-dependent fields | The campus `label`, the layer `label` and the chip `label` |
| Locale-independent fields | `id`, `endpoint`, `style`, `type`, `chipGroupId`, a chip's `icon` and `action`, and coordinates |
| Required response header | `Vary: Accept-Language` |

## Future extensibility

- A new layer type, such as `"heatmap"` or `"circle"`, arrives through the `type` field, and
  a client that does not know it ignores it.
- `style` grew once already, with the geometry the client used to hardcode. It can grow again
  the same way — `opacity` or `icon` — because an unknown member is ignored.
- POI category layers for restaurants or ATMs would be additional `"marker"` layers, in a
  later phase. The festival layers are the proof this works: they arrived as data, with no
  client release.
- **Grouping arrived, as `chipGroupId`.** A second group needs no client change: the resolution
  is generic over the group string, and the clear control writes nothing at all — it drops the
  stored narrowing, so what re-emerges is whatever the user had underneath it.
- **A date-scoped override** on top of the recurring schedule would arrive as a new optional
  sibling field, never as a `date` key added to `DailyWindow`. A sibling cannot change how existing
  data reads, whereas widening the window type would change the meaning of every window already
  authored. A client predating it ignores it and keeps the recurring answer.
- A third chip kind is reserved and not built — markers within N metres of a position. It needs
  its own client query hook rather than the layer one, because that keys its cache on the
  endpoint **string** and a URL carrying a camera position would mint a fresh entry per pan. The
  shape is in the server's `map-chip.types.ts`.
- The `campuses` array can grow without a client change, for a new satellite campus.
- A **new `tap.kind` does not** — it is the one thing here that still needs a client branch,
  because the client routes a tap on it. That is exactly why the festival kind is `event` rather
  than the festival's name: the branch resolves `placeId` against whichever event is live, so the
  next festival needs no new kind, no new route and no client release.

## Related

- [sdui-campus-spec.md](sdui-campus-spec.md) — the campus tab UI contract, which uses the
  same server-driven pattern
- [../README.md](../README.md) — the writing rules
