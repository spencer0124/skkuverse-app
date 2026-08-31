---
title: Mini App Platform Plan
type: plan
status: draft
owner: zoyoong124@gmail.com
last-updated: 2026-08-26
audience: internal
---

# Mini App Platform Plan

> How a SKKU club or department gets a **webview mini app that can send push notifications** on skkuverse's infrastructure. Covers what other platforms do, which model we adopt, and how clubs and developers are onboarded. For the app-side decisions, read [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md).

> [!NOTE]
> **Push is deferred.** The notification half of this plan is parked — the deployed half stays live
> and inert, and nothing further is built on it for now. Tracked in [skkuverse#49](https://github.com/spencer0124/skkuverse/issues/49).

> [!NOTE]
> This is a **product** document, covering what and why. What the app has to provide, and how
> backward compatibility is guaranteed, is its companion,
> [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md).

## Context

The value proposition is one sentence: **a club borrows skkuverse as its distribution and
notification channel, without its own app and without its own push infrastructure.** The club
needs nothing but a web page, for announcements, recruitment or an event, and skkuverse
handles the hard part, which is sending a push to the students who subscribed.

The constraints and what follows from them:

- **Solo development** rules out native mini apps, with their own review, runtime and SDK. So
  this is **webview only**, which inherits the browser sandbox for free and avoids building a
  custom JS runtime.
- **The push infrastructure already exists.** skkuverse already runs an FCM token multicast
  pipeline for notice push, described in
  [fcm-architecture](../explanation/fcm-architecture.md). Mini app push adds one topic and
  one send path on top of it rather than any new infrastructure.
- **The mini app substructure already exists** as well: a registry, deep links and a webview
  renderer. The current registrations live in the server's `src/miniapps/index.json`, and the
  renderer is now a mini-app-only shell at `app/mini-app.tsx`. What is missing is push and
  the two-way bridge.

So this plan is not about building something new. It is about **connecting the pieces that
exist and promoting them to a contract**.

## What other platforms do

Mini apps are not an invention. The major super apps have each solved this with different
trade-offs, and comparing them is how we decide where skkuverse sits.

| Platform | Runtime | SDK distribution | Push model | Trust boundary |
| --- | --- | --- | --- | --- |
| WeChat Mini Program | A custom JS runtime of its own, built on WXML and WXSS | A framework the platform mandates | Template messages, limited to user-action triggers | Strict review plus per-category permissions |
| LINE LIFF | **A webview with a host-hosted JS SDK** | The LIFF SDK loaded with `<script>` | A separate Messaging API, sent from a server | Per channel, with LIFF app registration |
| Telegram Mini Apps | A webview with a host-hosted SDK, `telegram-web-app.js` | `<script>` | The bot API, sent from a server | The bot's owner |
| Toss | Webview-centred with a native bridge | A partner SDK | Sent from a server, with partner approval | Partner review |
| KakaoTalk channels | The channel itself, web or in-app | — | Channel messages, sent from a server | Channel verification |

**skkuverse adopts a LIFF-like position**, for three reasons:

- A webview with **skkuverse hosting the JS SDK** lets the host shim older app versions at
  the SDK level, which is the core of backward compatibility. See ADR 0006, decision 3.
- Push is **sent from the server through an admin console** rather than by the webview's JS.
  A webview is an untrusted environment, so send rights do not belong on the client.
- A custom runtime, the WeChat approach, is outside what solo development can carry, so the
  radius stays at a webview.

## What a skkuverse mini app is

One mini app is a bundle of three things.

1. **A registered slug**, a stable kebab-case id that doubles as the `/m/<id>` deep link, the
   cache key and the analytics id. The schema is in
   `packages/shared/src/miniapps/schema.ts`.
2. **A `startUrl` web app**, the home URL the webview opens, provided by the club.
3. **Optionally a `miniapp:<id>` push topic.** When a user opts in they subscribe to it, and
   the club sends to that topic and no other from the console.

The mini apps registered today, listed in the server's `src/miniapps/index.json`, already
have the first two. They are **a smaller version of this shape**, missing only the third and
the two-way bridge.

> [!NOTE]
> On 2026-08-01 the registry moved to the server, behind `GET /miniapps` and
> `GET /miniapps/:id`. The bundled client JSON and the bundled logos are gone, so adding a
> mini app now takes **a server deploy with no app release**, which makes step 2 of the
> workflow below actually true. The details are in
> [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md), decision 2.

## The club's workflow (phase 1, curated)

In phase 1 the developer is the gatekeeper and the club writes no code.

1. **Submit.** The club fills in a form with the mini app's name, logo, web app URL
   (`startUrl`) and description.
2. **Register.** The developer adds the entry to the registry. Since the registry became
   server-driven, this takes effect without an app release. See ADR 0006, decision 2.
3. **Issue a console account.** The developer issues the club an admin console account, whose
   send rights cover **its own `miniapp:<id>` topic and nothing else**.
4. **Send.** The club writes a title, a body in each language, and optionally a deep link,
   then presses send. The server validates the payload and multicasts to the subscribers of
   `miniapp:<id>`.

```text
[club]                 [developer]              [skkuverse server]
 submits a web app URL ──▶ registers it
                           issues a console account ──▶ binds the miniapp:<id> scope
 writes and sends from the console ─────────────────▶ sendNotification(type:'miniapp')
                                                      → multicast to miniapp:<id> devices → students
```

> [!NOTE]
> The core of phase 1's UX is sending without code. A club with no backend server can send a
> push from the console alone. A per-club API key, for a club calling from its own server,
> stays open as a phase 2 option. See ADR 0006, decision 7.

## The developer's view: the mini app SDK

A club's web app attaches the skkuverse mini app SDK to work better inside the app, for
sharing, haptics, notification opt-in and native navigation. Note that this is **a UX bridge
rather than a way to send**: sending belongs to the console and the server.

```html
<!-- Hosted by skkuverse. A club does not bundle it, which is what makes shimming possible. -->
<script src="https://skkuverse.com/miniapp-sdk/v1.js"></script>
```

```ts
// When the web app boots
await sdk.ready(); // the web:ready handshake

// Negotiate the version, and always feature-detect so an older host degrades gracefully
const caps = await sdk.getCapabilities();
// caps = { sdkVersion: '1.x', supports: ['share', 'haptic', 'notificationOptIn', ...] }

if (caps.supports.includes('share')) {
  shareButton.onclick = () => sdk.share({ url: location.href });
}

if (caps.supports.includes('notificationOptIn')) {
  // Ask the user to subscribe to this club's push, the same result as the bell in the app chrome
  subscribeButton.onclick = () => sdk.requestNotificationOptIn();
}
```

The contract, whose full specification is in ADR 0006:

- **Never assume a message was handled.** Outside a webview, in an ordinary browser, or on an
  older host, a call is a silent no-op. Always check `getCapabilities()` and degrade to
  something else, such as the web share API, when a capability is absent.
- **skkuverse hosts the SDK**, so the contract is not frozen into the club's code and the
  host can shim older app versions.
- **There is no send API in the SDK.** A webview's JS is untrusted, so sending goes through a
  console login and its server-side scope.

## What a user sees

- Opening a mini app shows a **bell toggle** in the chrome, mirroring the notices tab's bell.
  This follows the Toss pattern, where a contextual entry point links to the global
  subscription. Turning it on opts into the `miniapp:<id>` topic.
- That opt-in becomes an intent write on `users/{uid}/preferences/main`, and the existing
  derive-then-sync chain carries it into the subscription. See
  [fcm-architecture](../explanation/fcm-architecture.md).
- When the club sends, a banner appears, and tapping it re-enters that mini app by reusing the
  existing `pendingMiniAppLink` consumer. See ADR 0006, decision 8.

## Roadmap

| Phase | Onboarding | Sending | New contract surface |
| --- | --- | --- | --- |
| 1, curated | The developer registers it | A no-code console | A remote registry, the `miniapp:<id>` topic, the console-to-CF payload |
| 2, a self-serve bridge | The club builds its own web app, with an origin allowlist | The console, plus an optional per-club API key | The public mini app SDK contract, and origin gate review |
| 3, self-serve onboarding | The club applies and registers from the console | As above | An automated registration workflow, plus suspension and deletion policy |

Each phase **extends the previous phase's contract without breaking it**, meaning
additive-only. See the backward-compatibility section of ADR 0006.

## Open questions

- **Console authentication.** How a club account is authenticated and isolated, whether
  through a Firebase Auth custom claim or a separate console session.
- **Abuse prevention.** Send rate limits, reporting and blocking spam or inappropriate
  content, and an audit trail of what was sent.
- **Lifecycle.** What happens to topic subscribers and send rights when a mini app is
  suspended or deleted.
- **Self-serve review criteria.** The security and content checklist for allowing a
  third-party origin in phase 2.

## Related

- [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md) — the app-side decisions
  and the backward-compatibility strategy, this document's companion
- [explanation/fcm-architecture.md](../explanation/fcm-architecture.md) — the current FCM
  token multicast and topic derivation
- [reference/deep-link.md](../reference/deep-link.md) — the `/m/<slug>` deep link contract
- [docs/README.md](../README.md) — the writing rules
