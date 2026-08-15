---
title: SDUI Campus Tab Specification
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-15
audience: public
---

# SDUI (Server-Driven UI) — Campus Tab

> The section-template SDUI contract that lets the server control how the campus tab is laid out. Read this before adding or changing a section or widget, on either side.

## Summary

The server decides which sections appear and in what order through a `sections` array, and
the client renders each one with a predefined widget. The shape is inspired by Toss's
HomeDST, simplified to SKKUBUS's scale.

**The principles it rests on:**

- The order of the `sections` array is the render order, so reordering on the server
  reorders the UI.
- The `type` field is the key that maps a section to a component.
- An unknown `type` renders as `null`, so an older app does not crash.
- A widget can be reused directly, outside any SDUI context.

## API

### `GET /ui/home/campus`

```jsonc
{
  "meta": { "lang": "ko" },
  "data": {
    "minAppVersion": "2.0.0",
    "sections": [
      {
        "type": "section_title",
        "id": "campus_title",
        "title": "캠퍼스 서비스" // conventions:allow-korean: live server payload
      },
      {
        "type": "button_grid",
        "id": "campus_buttons",
        "columns": 4,
        "items": [
          {
            "id": "building_map",
            "title": "건물지도", // conventions:allow-korean: live server payload
            "emoji": "🏢",
            "actionType": "route",
            "actionValue": "/map/hssc"
          },
          {
            "id": "lost_found",
            "title": "분실물", // conventions:allow-korean: live server payload
            "emoji": "🧳",
            "actionType": "webview",
            "actionValue": "https://webview.skkuverse.com/skku/lostandfound",
            "webviewTitle": "분실물", // conventions:allow-korean: live server payload
            "webviewColor": "003626"
          }
        ]
      }
    ]
  }
}
```

> [!NOTE]
> The `//` comments mark Korean that is live payload, for the conventions linter. They are
> not part of the response.

### `minAppVersion`

The minimum app version that can render this response correctly. Backward compatibility
normally rests on ignoring unknown types; this value is raised only for a breaking change,
to prompt an update. The client parses it as optional and does not use it today.

## Section types

### `button_grid`

Emoji-and-text buttons in an N-column grid.

| Field | Type | Description |
| --- | --- | --- |
| `columns` | int | Number of columns, defaulting to 4 |
| `items` | array | The button items |

Each item:

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique identifier |
| `title` | string | Display text, localised |
| `emoji` | string | A Unicode emoji, rendered in the Tossface font |
| `actionType` | string | `route`, `webview`, or `external` |
| `actionValue` | string | The navigation target |
| `webviewTitle` | string? | Title bar text for the web view |
| `webviewColor` | string? | Theme colour for the web view, hex without a `#` |

### `section_title`

A heading that separates sections.

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Display text |

### `notice`

A notice bar at the top. Tapping it runs the action.

| Field | Type | Description |
| --- | --- | --- |
| `title` | string | Notice text |
| `actionType` | string | `route`, `webview`, or `external` |
| `actionValue` | string | The navigation target |

### `banner`

An image banner. Tapping it runs the action.

| Field | Type | Description |
| --- | --- | --- |
| `imageUrl` | string | Banner image URL |
| `actionType` | string | `route`, `webview`, or `external` |
| `actionValue` | string | The navigation target |

### `spacer`

Vertical space between sections.

| Field | Type | Description |
| --- | --- | --- |
| `height` | number? | Height in px, defaulting to 16 |

## Action types

Every section uses the same action vocabulary.

| actionType | Behaviour | Example |
| --- | --- | --- |
| `route` | Navigate inside the app through Expo Router | `/map/hssc`, `/search` |
| `webview` | Open the in-app WebView | `https://webview.skkuverse.com/...` |
| `external` (or `url`) | Open the external browser or app | `http://pf.kakao.com/...` |

`external` and `url` are handled identically, so the server may send either.

## Client architecture

### File layout

```text
apps/mobile/src/sdui/
├── types.ts                  # Section types (discriminated union)
├── action-handler.ts         # Shared action handler (route/webview/external)
└── widgets/
    ├── index.ts              # type-to-component dispatcher
    ├── ButtonGrid.tsx        # GridView rendering
    ├── SectionTitle.tsx      # Heading text
    ├── Notice.tsx            # Notice bar
    ├── Banner.tsx            # Image banner
    └── Spacer.tsx            # Vertical space
```

### The discriminated union

```ts
type SduiSection =
  | { type: 'button_grid'; id: string; columns: number; items: SduiButtonItem[] }
  | { type: 'section_title'; id: string; title: string }
  | { type: 'notice'; id: string; title: string; actionType: string; actionValue: string }
  | { type: 'banner'; id: string; imageUrl: string; actionType: string; actionValue: string }
  | { type: 'spacer'; id: string; height?: number }
```

The dispatcher returns `null` for an unknown `type`, so nothing renders.

## Fallback

When the API call fails, React Query's cache or the default data is used.

## i18n

| Item | Value |
| --- | --- |
| How the locale is chosen | The server returns per-locale text based on the `Accept-Language` header |
| Supported locales | `ko` (default), `en`, `zh` |
| Locale-dependent fields | User-facing copy such as `title` and `label` |
| Locale-independent fields | `id`, `type`, `actionType`, `actionValue`, `emoji` |

## Adding a section type

1. **Server:** add the new object to the sections array.
2. **Client**, which needs an app update:
   - add the type to `types.ts`
   - create the component file under `widgets/`
   - add the case to the dispatcher in `widgets/index.ts`
3. **Backward compatibility:** an older app ignores the unknown type, so nothing crashes.

### Candidates for later

| type | Description |
| --- | --- |
| `list` | A vertical list |
| `card` | A card-shaped UI |
| `countdown` | A D-day countdown |
| `carousel` | A sliding banner |

## Related

- [map-config-api-spec.md](map-config-api-spec.md) — the map layer contract, which uses the
  same server-driven pattern
- [ux-writing.md](ux-writing.md) — the rules for user-facing copy such as `title`
- [../README.md](../README.md) — the writing rules
