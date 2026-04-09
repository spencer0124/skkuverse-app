# Map Config API Specification

Server-driven map layer configuration for the SKKUBUS app.

## Overview

The `/map/config` system replaces hardcoded campus markers and scattered bus route overlay logic with a unified, server-driven layer registry. The client fetches layer definitions at startup, renders filter UI dynamically, and lazily loads layer data on demand.

---

## 1. `GET /map/config` — Layer registry + campus definitions

Returns campus definitions and the list of available map layers. Must follow the v2 envelope format (`{ meta, data }`).

**Request:**
- `Accept-Language`: `ko` | `en` | `zh` (default: `ko`)
- `If-None-Match`: previous ETag value (optional, for conditional requests)

**Response headers (required):**
- `ETag`: opaque string (e.g. content hash or `"{version}:{timestamp}"`)
- `Vary: Accept-Language` — ensures caches/CDNs store separate copies per locale

**Response (200):**

```json
{
  "meta": {},
  "data": {
    "campuses": [
      {
        "id": "hssc",
        "label": "인사캠",
        "centerLat": 37.587241,
        "centerLng": 126.992858,
        "defaultZoom": 15.8
      },
      {
        "id": "nsc",
        "label": "자과캠",
        "centerLat": 37.293580,
        "centerLng": 126.974942,
        "defaultZoom": 15.8
      }
    ],
    "layers": [
      {
        "id": "campus_buildings",
        "type": "marker",
        "label": "건물번호",
        "defaultVisible": true,
        "endpoint": "/map/markers/campus"
      },
      {
        "id": "bus_route_hssc",
        "type": "polyline",
        "label": "인사캠 셔틀노선",
        "defaultVisible": true,
        "endpoint": "/bus/hssc/overlay",
        "style": { "color": "2D8C4E" }
      },
      {
        "id": "bus_route_nsc",
        "type": "polyline",
        "label": "자과캠 셔틀노선",
        "defaultVisible": true,
        "endpoint": "/bus/nsc/overlay",
        "style": { "color": "1A5FA8" }
      }
    ]
  }
}
```

**Response (304):** Empty body. Client keeps its cached config.

**Campus fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Campus identifier (`"hssc"` or `"nsc"`). |
| `label` | string | yes | Localized display name. |
| `centerLat` | number | yes | Campus center latitude (WGS84). |
| `centerLng` | number | yes | Campus center longitude (WGS84). |
| `defaultZoom` | number | no | Default map zoom level. Defaults to `15.8`. |

**Layer fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique layer identifier. Client uses as state key. |
| `type` | string | yes | `"marker"` or `"polyline"`. Client ignores unknown types. |
| `label` | string | yes | Localized display text for filter UI. |
| `defaultVisible` | boolean | no | Visible on initial load. Defaults to `false`. |
| `endpoint` | string | yes | Path to fetch layer data (markers or coords). |
| `style` | object | no | Rendering hints. Currently only `color`. |

**`style` fields:**

| Field | Type | Description |
|---|---|---|
| `color` | string | 6-digit hex without `#` (e.g. `"2D8C4E"`). Polyline stroke color. |

---

## 2. `GET /map/markers/campus` — Campus building markers

Returns ALL campus building markers (both HSSC and NSC). Client filters by `campus` field.

**Response:**

```json
{
  "meta": {},
  "data": {
    "markers": [
      {
        "id": "hssc_1",
        "code": "1",
        "name": "수선관",
        "campus": "hssc",
        "lat": 37.587361,
        "lng": 126.994479
      }
    ]
  }
}
```

**Marker fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique ID. Format: `{campus}_{code}`. Used as map marker ID. |
| `code` | string | no | Building number (displayed as marker caption). |
| `name` | string | yes | Building name (for search/info windows). |
| `campus` | string | yes | `"hssc"` or `"nsc"`. Client filters on this. |
| `lat` | number | yes | Latitude (WGS84). |
| `lng` | number | yes | Longitude (WGS84). |

---

## 3. Polyline overlay endpoints

The client expects polyline data at whatever `endpoint` is specified in the layer config.

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
|---|---|---|
| `coords` | `number[][]` | Ordered `[lat, lng]` pairs. Minimum 2 points. |

---

## Caching Strategy (ETag)

- Client uses HTTP ETag (RFC 7232). No separate version endpoint.
- Server returns `ETag` header on every `GET /map/config` response.
- Client stores the ETag in memory. Re-fetched on cold start.
- On app resume: client sends `If-None-Match: {stored_etag}`.
  - `304 Not Modified` → cache is fresh, zero body transferred.
  - `200 OK` → new data, client updates cache and stored ETag.
- Language change → client discards stored ETag and does a fresh fetch.

---

## i18n

- Server reads `Accept-Language` header.
- Supported: `ko` (default), `en`, `zh`.
- Localized fields: campus `label`, layer `label`.
- Locale-independent fields: `id`, `endpoint`, `style`, `type`, coordinates.
- Server must return `Vary: Accept-Language` header.

---

## Future Extensibility

- New layer types (e.g. `"heatmap"`, `"circle"`) via `type` field. Client ignores unknown types.
- `style` can grow (`width`, `opacity`, `icon`) without breaking clients.
- POI category layers (식당, ATM, etc.) as additional `"marker"` type layers — future phase.
- Layer grouping (`"group": "campus"`) for hierarchical filter UI — future phase.
- `campuses` array can grow (e.g. new satellite campuses) without client changes.
