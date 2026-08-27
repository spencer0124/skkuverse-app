---
title: Mini App Webview & Push Architecture
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-26
audience: internal
---

# 0006. Mini app webview and push architecture

> What contract a webview mini app runs on, what the app has to provide, and how backward compatibility survives for external web content that can never update in lockstep with the app. For the product and planning context, read the [mini app platform plan](../plans/miniapp-platform.md).

## Status

Accepted — 2026-07-22. **Decisions 1 and 2 are implemented** (2026-08-01,
`feat/webview-shell-split` plus the server's `feat/webview-ssot-miniapps`). The push half of
sections 6 to 8 was built and deployed on 2026-08-21; the SDK in sections 3 to 5 has not been
started.

> [!NOTE]
> **Push is deferred.** The deployed push path is left in place and is inert — `sendNotification` is
> HTTP-only behind an `x-api-key` gate, no schedule or trigger reaches it, and the app-side
> subscription toggle has been removed. Nothing further is built on it for now. Tracked in [skkuverse#49](https://github.com/spencer0124/skkuverse/issues/49).

Building it surfaced one decision outside this ADR's original scope: an origin gate on
the general-purpose `/webview` shell. It is the same trust-boundary problem as the mini app
SDK in section 4, but with a different subject, a first-party SPA rather than an arbitrary
external page. See section 9.

## Context

skkuverse is adding **webview mini apps that can send push**. The motivation and the use
cases are in the [plan](../plans/miniapp-platform.md). Solo development means webview only,
opening to third parties in stages: curated in phase 1, self-serve in phase 2.

The hard part is not the feature, it is **backward compatibility**. A mini app is external
web content that cannot update in lockstep with the app. When a club builds one against the
contract as it stands today, it has to keep working in front of users running an old build.
That is a platform SDK versioning problem rather than a feature problem, and the
architecture choice is the answer to it.

### What already exists, found by exploring

Much of the substructure is already there. This ADR connects and formalises rather than
builds.

| Piece | Location | State |
| --- | --- | --- |
| Mini app registry | ~~`packages/shared/src/miniapps/{schema,repository,index.json,details/*}`~~ → **server `src/miniapps/`** | **Implemented.** `GET /miniapps`, `GET /miniapps/:id`. The bundled client JSON is gone, and `assertValidRegistry` aborts server boot on an invalid registry |
| Server-driven seam | `packages/shared/src/miniapps/repository.ts`, the `miniAppRepository` alias | Prepared, comment and all, to flip to `remoteMiniAppRepository` |
| Mini app renderer | ~~`apps/mobile/app/in-app-browser.tsx`~~ → **`apps/mobile/app/mini-app.tsx`** | **Implemented.** Registered mini apps only. Arbitrary URLs split out to `app/webview.tsx` |
| Deep link | `apps/mobile/app/+native-intent.tsx`, `MINIAPP_PATH_RE` | `skkuverse://m/<slug>` routes already |
| Pending holder and consumer | `apps/mobile/src/lib/pending-mini-app-link.ts` plus `app/_layout.tsx` | **Already exists**, and push tap routing can reuse it |
| WebView-to-RN protocol seed | `apps/mobile/src/features/mini-app/protocol.ts` | Defined but unwired. The page-extraction half is dead code since on-device AI was removed, and is a deletion candidate |
| First-party bridge | `packages/bridge/` | Web to app is wired; native to web is a placeholder |
| Push delivery CF | `functions/src/send-notification.ts` | `switch(body.type)` has `case 'notice'` alone. A single `FCM_API_KEY`, so **any caller can target any topic** |
| Topic derivation | `functions/src/notifications/{derive,tabsContract}.ts` | A topic is a Firestore label. Multicast by `array-contains-any` |
| Push tap routing | `apps/mobile/src/services/notification-router.ts` | `navigateFromNotification` has `case 'notice'` alone |

> [!NOTE]
> Everything else follows from this. A skkuverse "topic" is not a native FCM
> subscription. It is a label in the `devices` document's `subscribedTopics`, and delivery is
> an `array-contains-any` token multicast (see
> [fcm-architecture](../explanation/fcm-architecture.md)). So mini app push is the
> combination of a `miniapp:<id>` topic prefix, a `miniapp` case in the CF and the router,
> and a per-club sending scope, which is a new security boundary.

## Decision

### 1. Reuse the renderer (implemented)

Rather than build a new screen, promote the existing in-app browser to the mini app host. It
already has registry lookup, chrome and deep links.

Building it exposed something else. That screen was at once the mini app shell and the
viewer for arbitrary external links. `openInAppBrowser()` was a one-line wrapper around
`openMiniApp()`, so notice bodies, markdown links and SDUI `external` targets were all routed
to a mini app shell complete with a bookmark button and "add to home screen". Promotion
meant **separation**:

- `app/mini-app.tsx` for registered mini apps alone. Only the slug travels in the route; the
  rest is resolved from the registry.
- `app/webview.tsx` for every other URL, with minimal chrome: a native header, the content,
  and an ad banner.
- `openInAppBrowser()` is deleted. No helper is left behind that could blur the two doors
  again.

### 2. Make the registry server-driven (implemented)

Flip `miniAppRepository` to `remoteMiniAppRepository`. The seam already exists. This means
**onboarding a mini app without an app release**. The contract discipline that comes with it:

- The schema is **additive only**. Do not remove a field or change what one means.
- A breaking change goes through the `MINIAPP_REGISTRY_VERSION` gate, and nowhere else.
- The client **ignores unknown fields** for forward compatibility, so an old build meeting a
  new field from a newer server does not die.

### 3. Host the mini app SDK ourselves (the heart of backward compatibility)

Clubs do not bundle the SDK. They load
`<script src="https://skkuverse.com/miniapp-sdk/vN.js">`, the LIFF model. That is what lets
**skkuverse shim old app versions at the SDK level**. Keeping the contract out of the club's
compiled code is the entire point of this choice.

### 4. Treat the native bridge as a mini-app-only channel

Wire the `protocol.ts` seed into the host's `onMessage` and
`injectedJavaScriptBeforeContentLoaded`.

- **Gate on the registered `startUrl` origin.** Handle messages from allowlisted origins
  only.
- **Scope by capability.** A mini app can call only the message set it was granted.
- **Keep it separate from the first-party `@skkuverse/bridge`.** The trust boundaries
  differ: first-party is trusted, a third-party mini app is not. Sharing some code during
  the curated phase 1 is fine, but **the boundary is drawn by origin and capability, not by
  which module the code lives in**.

### 5. Negotiate versions with a handshake

A mini app asks `getCapabilities()` for the host SDK version and its supported message set,
then feature-detects and degrades gracefully. `postToApp` is a no-op outside a webview and
on older hosts, so the contract forbids assuming a message was handled. A mini app written
for SDK v3 still runs, reduced, on an app carrying SDK v1.

### 6. Push subscription through a `miniapp:<id>` topic

Introduce the topic prefix `miniapp:<id>`.

- Add the derivation rule to `deriveSubscribedTopics`
  (`functions/src/notifications/derive.ts`) and `tabsContract.ts`, or add a separate
  `miniAppSelections` intent field. Decide that when the code is written.
- A user's bell toggle writes intent to `preferences/main`, and the existing derive-then-sync
  chain carries it to `devices.subscribedTopics`. **The push pipeline itself is untouched.**

### 7. Originate push from a no-code console, scoped by the server

Clubs write and send from a skkuverse-hosted admin console, whose backend calls the CF with
a new payload.

```ts
// The shape to add to functions/src/types.ts (illustrative)
interface MiniAppNotificationPayload {
  type: 'miniapp';
  miniAppId: string;      // the scope key
  title_ko: string;
  body_ko: string;
  title_en?: string | null;
  body_en?: string | null;
  // The caller does not choose topics - the server forces miniapp:<miniAppId>
}
```

- **The server forces the topic to `miniapp:<miniAppId>`**, which closes today's "any key
  targets any topic" gap right here. A club cannot send outside its own topic.
- A club authenticates by **logging into the console**. No raw shared key is ever handed to
  a club. A per-club API key, for clubs calling from their own server, is a phase 2 option.

### 8. Extend the CF and tap routing

- Add `case 'miniapp'` to `functions/src/send-notification.ts` plus a sibling
  `handle-miniapp.ts`, mirroring `handle-notice.ts` for locale bucketing, the
  `Record<string,string>` data payload, multicast, and token cleanup.
- Add `case 'miniapp'` to `navigateFromNotification` in
  `apps/mobile/src/services/notification-router.ts`, routing to
  `router.navigate('/(tabs)/home')` with `pendingMiniAppLink.set({ id })`. **The existing
  `PendingMiniAppLinkConsumer` is reused unchanged.**

### 9. An origin gate on the general-purpose `/webview` (implemented, added during implementation)

The separation in section 1 meant **an arbitrary external page could reach `/webview` for
the first time**. Until then that screen only ever received first-party SPAs, lost-and-found
and the bus guide, and on that assumption it handled any message unconditionally:
`web:open-url` called `Linking.openURL(msg.url)`, `web:navigate` called
`router.push(msg.path)`. Sending a notice body there breaks the assumption. The gate is
a precondition of that change rather than a follow-up to it.

- **Capability is decided by the origin of the loaded document**, not by the caller that
  opened the screen. A webview navigates, so a permission granted at open time would live on
  at an origin nobody checked. Re-evaluate `event.nativeEvent.url` **per message**.
- **The allowlist is server-owned**: `GET /app/config` returns `webview.bridgeOrigins`, from
  `BRIDGE_ORIGINS` in the server's `src/infra/origins.ts`. A capability prop passed by the
  caller would become a second, and staler, source of truth.
- **Fail closed.** No config, a failed fetch, unparseable data, or an origin mismatch all
  yield `[]`. This is **deliberately the opposite** of how the rest of this package fails,
  where `useCampusSections` hands back defaults. A stale tab beats an empty one, but failing
  open here would hand `Linking.openURL` to an unvetted page.
- **`web:navigate` is excluded from the grant set.** `apps/webview` has never sent it, yet
  the handler sat there unguarded. Do not revive it without a path allowlist.

> [!WARNING]
> What this gate does not stop: on Android a child iframe can post to the bridge, while
> `nativeEvent.url` reports the **top-level** document. An allowlisted first-party page that
> embeds an untrusted iframe therefore leaks its permissions. The only bridged origin today
> is our own SPA, which embeds no such iframe, but that is an **invariant of the allowlist**
> rather than a property of the code. It is why adding an entry to `BRIDGE_ORIGINS` is a
> trust decision.

## Backward-compatibility principles

The heart of this ADR: the discipline that keeps a mini app contract alive across app
versions.

- **The product is the contract, not the code.** Three contract surfaces are each versioned
  and additive-only:
  1. The registry schema (`schema.ts`, `MINIAPP_REGISTRY_VERSION`)
  2. The mini app SDK message set (decisions 4 and 5)
  3. The push payload and topic naming (decisions 6 and 7)
- **A host-hosted SDK** (decision 3) shims old app versions, which detaches the cost of
  evolving the contract from the app release cycle.
- **Capability negotiation** (decision 5) lets a mini app built for a newer SDK degrade on an
  older app.
- **The danger zone is anything bound to the app version.** Native bridge handlers, tap
  routing and `notification-router` are JS and mostly reachable by OTA, but **users who never
  receive the OTA** are the risk. The response:
  - Put the webview channel and the handshake into the binary early, and keep improving the
    handler logic over OTA.
  - Ship the `miniapp` push tap case **before any club can send**. On an app without it, an
    unknown type degrades to a no-op: the OS still shows the banner, the tap does nothing,
    and nothing crashes.

## Consequences

- (+) Maximum reuse. The renderer, deep links, the pending consumer, the FCM pipeline and the
  registry seam are all connected rather than rebuilt.
- (+) A remote registry means **onboarding without an app release**.
- (+) Server-side topic scoping (decision 7) closes today's "any key targets any topic" gap.
- (−) **A new security boundary becomes the only defense**: console authentication plus
  server-side topic scoping. There is no intermediate validation layer, exactly as with
  Firestore Rules ([ADR 0005](0005-user-firebase-public-mongodb.md)), so the scope invariants
  have to be pinned by the emulator-backed `functions` verify scripts.
- (−) One more cross-repo contract mirror: the console and the CF's
  `MiniAppNotificationPayload`, of the same kind as the mirror pattern in
  [add-notice-tab](../how-to/add-notice-tab.md).
- (−) The origin gate and the capability set have to be reviewed and maintained once phase 2
  is self-serve.

### Alternatives rejected

- **Clubs bundle the SDK.** The contract freezes at build time, so old app versions cannot be
  shimmed. Rejected as the opposite of decision 3.
- **Reuse the first-party `@skkuverse/bridge`.** Different trust boundary, and it risks
  exposing privileged messages to code we do not trust. Separated in decision 4.
- **Let the client, the webview JS, send push directly.** A webview is an untrusted
  environment, and putting send rights there allows arbitrary spam. Rejected in favour of
  the server scope in decision 7.
