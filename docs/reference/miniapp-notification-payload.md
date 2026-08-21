---
title: Mini App Notification Payload
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-19
audience: internal
---

# Mini App Notification Payload

> The wire contract for mini-app push, from the body a caller posts to the `sendNotification` Cloud Function through to the navigation a tap produces. Read this before writing either half, because the two halves reach users by different routes.

## Why this document exists

The app half and the server half of this contract are released separately. The server and the
Cloud Function can be redeployed while an event runs. The code that reads the payload on a phone
cannot, so it has to be right before the binary or the OTA carrying it goes out. Pinning the
shape once, here, is what lets the two halves be built in either order.

The architecture around it is [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md)
sections 6 to 8, which sketched this payload as illustrative. This document is the settled
version. The feed a notification is recorded in comes from the amendment in
[ADR 0002](../decisions/0002-no-notification-inbox.md).

## Message types

| `type` | Visible | Purpose |
| --- | --- | --- |
| `miniapp` | Banner and sound | A mini app announces something to its subscribers |
| `eventmap-refresh` | Silent, no banner | Invalidates the cached event-map manifest on the device |

Both are scoped the same way, and the scoping is the security boundary rather than a
convenience. The caller never chooses a topic. The server derives `miniapp:<miniAppId>` from the
authenticated caller, which is what closes the "any key targets any topic" gap named in ADR 0006.

## Surface 1 — caller to the Cloud Function

The HTTP body posted to `sendNotification`, authenticated by the existing `x-api-key` header.

```ts
export interface MiniAppNotificationPayload {
  type: 'miniapp';
  /** Scope key. The server forces the topic to `miniapp:<miniAppId>`. */
  miniAppId: string;
  /** The feed entry this delivery corresponds to. */
  notificationId: string;
  title_ko: string;
  body_ko: string;
  title_en?: string | null;
  body_en?: string | null;
  /** Where a tap lands. Omit both to fall back to the mini app itself. */
  actionType?: 'webview' | 'external' | 'route' | 'miniapp';
  actionValue?: string;
}

export interface EventMapRefreshPayload {
  type: 'eventmap-refresh';
  miniAppId: string;
  /** Logged, never displayed. */
  reason?: string;
}
```

Three things about this shape are deliberate.

**There is no `topics` field**, unlike `NoticeNotificationPayload`. A notice caller passes topics
because the crawler already knows which boards a notice was posted to. A mini-app caller must not,
because it is the thing being constrained.

**`notificationId` is required.** The send path writes the feed entry and then calls this
function, and this field is what makes "the feed and the delivery cannot diverge" checkable after
the fact rather than merely intended.

**The locale pair mirrors the notice payload**, including the `title_en ?? title_ko` fallback, so
a Korean-only sender needs no extra handling.

## Surface 2 — the FCM `data` map

FCM v1 validates that every `data` value is a string, so the map is flat with no nested JSON.
Absent optional fields are omitted rather than sent empty, matching `handle-notice.ts`.

| Key | `miniapp` | `eventmap-refresh` |
| --- | --- | --- |
| `type` | `"miniapp"` | `"eventmap-refresh"` |
| `miniAppId` | always | always |
| `notificationId` | always | absent |
| `actionType` | when supplied | absent |
| `actionValue` | when supplied | absent |

The title and body travel in the `notification` block, not in `data`, again as the notice path
already does.

### Delivery options

A `miniapp` message carries a `notification` block, `android.priority: 'high'` and an Android
channel id. An `eventmap-refresh` message must carry no `notification` block at all, or the OS
draws a banner for something the user was never meant to see:

```ts
android: { priority: 'high' },
apns: {
  headers: { 'apns-push-type': 'background', 'apns-priority': '5' },
  payload: { aps: { 'content-available': 1 } },
},
```

`apns-priority` is `5` rather than `10`. Apple rejects a background push sent at the higher
priority, and the rejection is per-message, so getting this wrong disables the whole correction
lever rather than degrading it.

### The Android channel

Mini-app notifications use one shared channel rather than one per mini app, because channels are
created at app startup and the app does not hold the registry at that moment. Adding it means a
new entry in `NotificationChannelId` and `CHANNELS` in
`apps/mobile/src/services/notification-channels.ts`, mirrored on the Cloud Function side the way
`channels.ts` already mirrors the notice channels.

Both are ordinary JS, so a new channel reaches users over OTA. If a device has not yet received
it, Android falls back to the default channel: the notification still arrives, and the user
loses per-channel importance until the update lands.

## Surface 3 — routing on the device

`apps/mobile/src/services/notification-router.ts` gains one case. The tap target is resolved as an
**action**, through the same `parseActionType` and `handleSduiAction` a sheet button uses, rather
than as a notification-only scheme. The navigable set is `route`, `webview` and `external`;
everything else falls back (see below).

The decision is a pure function, `resolveNotificationTap` in `packages/shared/src/notifications/`,
so it holds identically for all four entry points — quit-state launch, warm tap, foreground notifee
press, background notifee press. The router only performs the result, and always through a pending
holder: a quit-state tap can resolve before the root navigator has a key, and a push against an
unmounted navigator is silently lost.

That reuse buys the forward compatibility this contract needs. `parseActionType` maps anything it
does not recognise to the `unknown` sentinel and `handleSduiAction` does nothing with it, so a
payload written for a newer app degrades to a no-op on an older one instead of opening an
arbitrary string.

### Falling back to the mini app itself

**The app never produces a dead tap for a `miniapp` message.** Whenever the payload does not name a
target this build can navigate, the tap opens the mini app by id, through the `pendingMiniAppLink`
holder and its consumer in `app/_layout.tsx`. The consumer resolves the slug against
`GET /miniapps/:id` and drops it silently when the lookup fails.

Four cases reach that fallback, and a sender should expect all four to land on the same screen:

| Case | Why it falls back |
| --- | --- |
| `actionType` and `actionValue` both omitted | The documented default |
| `actionType: 'miniapp'` | Deferred on the device — see the compatibility rules below |
| `actionType: 'content'` | Prose for a sheet to render; there is no sheet in a notification tap |
| An `actionType` newer than the installed build | `parseActionType` maps it to `unknown` |
| An `actionValue` whose shape the type does not accept | See the shape rules below |

**`actionValue` shape is checked, and a bad one falls back rather than being followed.**
`webview` and `external` must be `https://` with no whitespace; `route` must begin with `/`. The
first rule matters most: both send to `openWebView`, whose `normalizeWebUrl` hands anything non-web
to `Linking.openURL`, so an unchecked value could make the device open `itms-apps:`, `tel:` or a
custom scheme — the "uninterpreted string reaches a URL opener" failure the `unknown` sentinel
exists to prevent, on the one surface where that string is fully sender-shaped. These are the same
rules `isValidActionValue` in `eventmap/parser.ts` already applies, so a notification payload and a
map button agree about what a `webview` is.

Two deliberate departures from how this work was first described are recorded here because the
server half is written against this document, not against the issue threads:

**The default is not the ESKARA feed URL.** A URL for one event, compiled into the app, is the
pattern epic §4.1 rules out: the moment a generic renderer names a specific consumer, next year's
event stops being a data change. Resolving through the registry reaches the same screen while
leaving the destination a server-side value, so a wrong guess is fixable without shipping anything.

**An unrecognised `actionType` falls back rather than doing nothing.** The original wording said it
degrades to a no-op. The property that wording protected is *never hand an uninterpreted string to
a URL opener*, and the fallback does not touch `actionValue` at all — it uses `miniAppId`, which the
consumer looks up in the registry. So the safety property is intact, and the failure mode improves
from a tap that appears broken to a tap that lands one screen up. During an event, where a wrong
`actionType` cannot be corrected on the device, that difference is the whole point.

`resolveNotificationTap` in `packages/shared/src/notifications/` is the single implementation of
this table, and its test file is the executable version of it.

### The silent type is not a routing case

`eventmap-refresh` never produces a tap, so it does not belong in the router. It is handled where
messages are received, by invalidating the manifest query. Adding it to
`navigateFromNotification` would create a branch that cannot be reached.

## Subscription intent

A mini-app subscription is a new intent field on `preferences/main`, not a reuse of the notices
fields:

```ts
miniAppSelections: string[];   // mini-app ids, client-writable intent
```

`deriveSubscribedTopics` maps each id to `miniapp:<id>`. Two properties follow, and both are
intended:

- **Independent of `categoryEnabled.notices`.** Someone who turned notices off can still be
  subscribed to a mini app, because the two are unrelated products.
- **Still gated by the master `enabled` flag**, which returns an empty array before any of this
  is consulted.

The alternative was to route mini apps through `pickerSelections` with a synthetic picker key.
That was rejected because `tabsContract` is a hardcoded mirror of the backend's notice categories,
and a drift there is already a coordinated-change hazard. Putting a concept that is not a notice
tab into that mirror widens a contract whose whole cost is that it has to be updated in lockstep
with another repository.

## Compatibility rules

- **`data` is additive only.** Do not remove a key or change what one means. The app ignores keys
  it does not know.
- **An app with no `miniapp` case** returns `false` from `navigateFromNotification`. The banner
  still appears, the tap does nothing, and nothing crashes.
- **Add the tap case before any caller can send.** Otherwise the first real notification is also
  the first one whose tap goes nowhere.
- **Changing `actionType` later is a payload change, not a release** — but only between the
  navigable types (`route`, `webview`, `external`). Use `webview` for ESKARA.
- **`actionType: 'miniapp'` is NOT wired on the device, and sending it lands on the mini app
  itself.** It is not a broken value, just a redundant way of asking for the fallback. It stays
  deferred because its value shape is undecided in two places at once: the event-map parser
  validates a `miniapp` `actionValue` as an HTTPS URL (`eventmap/parser.ts`), while
  `openMiniAppById` takes a registry slug. Settling that is
  [eventmap-rendering.md](../explanation/eventmap-rendering.md) §7.3 work with real security content
  (resolve the sub-path against the registry `startUrl`, fail closed on an origin mismatch), and a
  guess frozen into a shipped binary cannot be corrected mid-event.

## Related

- [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md) — sections 6 to 8, the
  architecture this payload implements
- [ADR 0002](../decisions/0002-no-notification-inbox.md) — the Revisited section, why a feed
  exists to land in
- [fcm-architecture.md](../explanation/fcm-architecture.md) — how a topic becomes a multicast
- [sdui-campus-spec.md](sdui-campus-spec.md) — the action union this reuses
