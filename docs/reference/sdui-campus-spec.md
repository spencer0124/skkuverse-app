---
title: SDUI Campus Tab Specification
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-28
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
- A widget carries no horizontal gutter. Its caller owns one, because the caller is the only
  side that knows how far its container is inset.

## Where it renders

The campus tab's bottom sheet, in `apps/mobile/src/features/map/CampusScreen.tsx`. The sheet
holds a promotional feed (notices, banners, event entries), and nothing else on the screen
consumes this endpoint. That surface shapes the contract, not only the styling:

- **Blocks sit on liquid glass for most of the sheet's travel.** The opaque fill only
  dissolves in over the final drag, so a section that paints no fill of its own is drawn over
  a live map. See
  [bottom-sheet-system.md](../explanation/bottom-sheet-system.md).
- **Long-form content does not belong in a section.** It belongs behind a `webview` or
  `miniapp` action, which opens a full screen. The sheet is a place to hand off from rather
  than a place to read in.

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
| `webviewTitle` | string? | Title bar text for the web view. Empty falls back to the page's own `<title>` |
| `webviewColor` | string? | Theme colour, hex without a `#`. **Accepted and ignored** by the app — kept on the wire so the server contract does not have to change |

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
| `webview` | Open the in-app WebView at `/webview` | `https://webview.skkuverse.com/...` |
| `external` (or `url`) | The **same** in-app `/webview` screen; only a non-web scheme leaves the app | `http://pf.kakao.com/...` |

`external` and `url` are handled identically, so the server may send either.

> [!NOTE]
> `external` no longer opens the system browser. `handleSduiAction` routes `webview` and `external`
> through the same `openWebView()` helper, and only a value whose scheme a WebView cannot render —
> `mailto:`, `tel:`, `itms-apps:` — is handed to `Linking.openURL`. The two remain separate action
> types because the server still emits both and older clients treat them differently. What a loaded
> page is permitted to do is decided per message from the document's own origin, not from the action
> type that opened it.

## Client architecture

### File layout

```text
apps/mobile/src/sdui/
├── renderer.tsx              # type-to-component dispatcher, with a `never` exhaustiveness guard
├── action-handler.ts         # Shared action handler (route/webview/external)
└── widgets/
    ├── ButtonGrid.tsx        # Grid rendering
    ├── SectionTitle.tsx      # Heading text
    ├── Notice.tsx            # Notice bar
    ├── Banner.tsx            # Image banner
    └── CampusSkeleton.tsx    # Loading placeholder
```

The section types themselves live in `packages/shared/src/types/sdui.ts`, not beside the widgets —
the wire contract is shared code, the rendering is not. `spacer` needs no widget file; the renderer
emits a sized `<View>` inline.

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

A failed call falls back to React Query's cache, and past that to
`DEFAULT_CAMPUS_SECTIONS` (`packages/shared/src/sdui/defaults.ts`), which is **empty**.
`useCampusSections` never throws, so `isError` is never true.

Empty is deliberate for this surface. A stale promo is worse than no promo, and an empty
card over the map is a legitimate resting state. It also makes a whole bug class
unrepresentable: the fallback used to be a hardcoded button grid whose targets drifted from
the server's twice, and a fallback that disagrees with the server only ever surfaces when
nobody is looking.

The trade is that a caller cannot distinguish a dead API from a server with nothing to show.
Both render the same empty card, which is the right answer here.

## i18n

| Item | Value |
| --- | --- |
| How the locale is chosen | The server returns per-locale text based on the `Accept-Language` header |
| Supported locales | `ko` (default), `en`, `zh` |
| Locale-dependent fields | User-facing copy such as `title` and `label` |
| Locale-independent fields | `id`, `type`, `actionType`, `actionValue`, `emoji` |

## Adding a section type

Before adding one, check that it is warranted. A new *arrangement* of existing material is
a template, not a widget; only a genuinely new *interaction* earns a section type. An
unbounded widget catalogue is the documented way this pattern dies, and the repo already has
a bounded alternative in the event map's card slots
(`packages/shared/src/types/eventmap.ts`), where a template names which slots appear in what
order and the item supplies the values.

1. **Server:** add the new object to the sections array.
2. **Client**, which needs an app update:
   - add the type to the union in `packages/shared/src/types/sdui.ts`
   - handle it in `parseSection` (`packages/shared/src/sdui/parser.ts`), or it arrives as
     `unknown`
   - create the component file under `apps/mobile/src/sdui/widgets/`
   - add the case to the dispatcher in `apps/mobile/src/sdui/renderer.tsx`, whose `never`
     guard fails the build until you do
3. **Backward compatibility:** an older app ignores the unknown type, so nothing crashes.

### Candidates for later

| type | Description |
| --- | --- |
| `list` | A vertical list |
| `card` | A card-shaped UI. Build it as a slot template rather than a widget per shape, copying `resolveSlots` in `packages/shared/src/eventmap/card.ts` |
| `countdown` | A D-day countdown |
| `carousel` | A sliding banner |

## Related

- [map-config-api-spec.md](map-config-api-spec.md) — the map layer contract, which uses the
  same server-driven pattern
- [ux-writing.md](ux-writing.md) — the rules for user-facing copy such as `title`
- [../README.md](../README.md) — the writing rules
