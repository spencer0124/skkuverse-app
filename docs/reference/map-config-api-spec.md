---
title: Map Config API Specification
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-28
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
| `GET /map/config` | The layer registry and the campus definitions |
| `GET /map/markers/campus` | Every campus building marker |
| The `endpoint` value of a layer | Polyline coordinate data |

Every response uses the v2 envelope format, `{ meta, data }`.

## `GET /map/config`: the layer registry and campus definitions

Returns the campus definitions and the list of available map layers.

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
        "defaultVisible": true,
        "endpoint": "/map/markers/campus?overlay=number"
      },
      {
        "id": "building_labels",
        "type": "marker",
        "markerStyle": "textLabel",
        "label": "건물이름", // conventions:allow-korean: live server payload
        "defaultVisible": true,
        "endpoint": "/map/markers/campus?overlay=label"
      }
    ]
  }
}
```

> [!NOTE]
> The sample matched the live `GET /map/config` response as of 2026-08-09. The authority is
> the server's `src/map/map-config.data.ts`. An earlier revision of this document described
> a single `campus_buildings` layer and `bus_route_*` polylines, neither of which exists:
> the polylines are commented out on the server.
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
| `defaultVisible` | boolean | No | Whether the layer shows on first load, defaulting to `false` |
| `endpoint` | string | Yes | Where to fetch this layer's markers or coordinates |
| `style` | object | No | Rendering hints. Only `color` is supported today |

### `style` fields

| Field | Type | Description |
| --- | --- | --- |
| `color` | string | Six hex digits without a `#`, such as `"2D8C4E"`. The polyline stroke colour |

## `GET /map/markers/campus`: campus building markers

Returns **every** building marker for both the humanities campus (HSSC) and the natural
sciences campus (NSC). The client filters by campus itself, using the `campus` field.

### Response

```jsonc
{
  "meta": {},
  "data": {
    "markers": [
      {
        "id": "hssc_1",
        "code": "1",
        "name": "수선관", // conventions:allow-korean: live server payload
        "campus": "hssc",
        "lat": 37.587361,
        "lng": 126.994479
      }
    ]
  }
}
```

### Marker fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique id in the form `{campus}_{code}`, used as the map marker id |
| `code` | string | No | Building number, shown as the marker caption |
| `name` | string | Yes | Building name, for search and the info window |
| `campus` | string | Yes | `"hssc"` or `"nsc"`, which the client filters on |
| `lat` | number | Yes | Latitude (WGS84) |
| `lng` | number | Yes | Longitude (WGS84) |

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

## Caching with ETag

- The client uses HTTP ETags (RFC 7232). There is no separate version endpoint.
- The server returns an `ETag` header on every `GET /map/config` response.
- The client holds the ETag in memory and fetches afresh on each cold start.
- On resume the client sends `If-None-Match: {stored_etag}`.
  - `304 Not Modified` means the cache is fresh, with no body transferred.
  - `200 OK` means new data, so the client updates both its cache and the stored ETag.
- Changing the language makes the client discard the stored ETag and fetch afresh.

## i18n

| Item | Value |
| --- | --- |
| How the locale is chosen | The server reads the `Accept-Language` header |
| Supported locales | `ko` (default), `en`, `zh` |
| Locale-dependent fields | The campus `label` and the layer `label` |
| Locale-independent fields | `id`, `endpoint`, `style`, `type`, and coordinates |
| Required response header | `Vary: Accept-Language` |

## Future extensibility

- A new layer type, such as `"heatmap"` or `"circle"`, arrives through the `type` field, and
  a client that does not know it ignores it.
- `style` can grow without breaking a client, with `width`, `opacity` or `icon`.
- POI category layers for restaurants or ATMs would be additional `"marker"` layers, in a
  later phase.
- Grouping layers for a hierarchical filter UI, with something like `"group": "campus"`, is
  also a later phase.
- The `campuses` array can grow without a client change, for a new satellite campus.

## Related

- [sdui-campus-spec.md](sdui-campus-spec.md) — the campus tab UI contract, which uses the
  same server-driven pattern
- [../README.md](../README.md) — the writing rules
