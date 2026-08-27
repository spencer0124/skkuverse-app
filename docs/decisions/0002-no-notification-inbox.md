---
title: No Notification Inbox (Option D)
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-26
audience: internal
---

# 0002. Push without a notification inbox (option D)

## Status

Accepted — 2026-04, decided while designing FCM push. Recorded 2026-07-21.
**Amended 2026-08-19**, narrowed rather than reversed: see Revisited below.

## Context

Designing FCM push meant deciding whether past notifications should be re-readable inside
the app. An inbox would need a per-user notification collection on the server to hold
that history. Read-state sync, a retention window and a cleanup policy all follow from it.

Most of this app's pushes announce a notice, and the notice itself already exists as server
data in the notices tab. The content stays reachable whether or not an inbox exists.

## Decision

**Do not build an inbox.**

- Keep no notification history, on the server or on the device.
- Compute the app icon badge locally with Zustand and Notifee, with no server round trip.
- Tapping a push deep-links straight to the notice, and the notification's life ends there.

## Consequences

- (+) The per-user notification store, the read-state sync, and the retention policy all
  disappear from both sides.
- (+) The badge is device-local state, so it reacts without waiting on Firestore.
- (−) A notification cleared from the system notification centre cannot be recovered.
  Acceptable, because the notice itself remains in the notices tab, which absorbs the
  re-reading need.
- (−) A notification that is not a notice, such as a future one-off announcement, has no
  recovery path once missed. Revisit this decision if that kind starts appearing.

## Revisited — 2026-08-19

> [!NOTE]
> The feed described below was built and deployed on 2026-08-21, and **mini-app push is now
> deferred** — it stays deployed and inert while nothing further is built on it. The amendment
> itself stands. It is the work that is parked, not the decision. Tracked in [skkuverse#49](https://github.com/spencer0124/skkuverse/issues/49).

The condition in the last consequence fired. The ESKARA 2026 mini app sends notifications that
are not notices — a rain delay, or a shuttle change partway through the day. Neither has an
entry in the notices tab to fall back on, so a cleared banner is unrecoverable, which is the
case this ADR said to come back for.

### What changes

A mini app gets a **broadcast notification feed**.

- One server-side log per mini app, scoped by mini-app id.
- Read over a public endpoint and rendered by the mini app's own webview page, not by a native
  screen.
- The send path appends to the log and calls the Cloud Function together, so what the feed shows
  and what was delivered cannot drift apart.

### What does not change

The decision above still holds where it was aimed.

- **Notices keep no inbox.** The notices tab remains the recovery surface for them, and the
  reasoning in Context is untouched.
- **No per-user state anywhere.** The feed is broadcast-only: no auth, no read and unread, no
  per-user collection, no read-state sync. All three (+) consequences above survive intact.
- **The badge stays device-local**, computed with Zustand and Notifee with no server round trip.

What this ADR rejected was a per-user notification store and the read-state sync, retention window
and cleanup policy that follow from it. That is still rejected. What is being added is a record of
what was broadcast, which sits closer to the notices tab than to an inbox: it is server data that
exists anyway and carries no user dimension. The cost this ADR was avoiding was the per-user half,
and the per-user half is not being built.

### A note on the name

The work is tracked as an "inbox" and the route is spelled that way, which reads as the thing this
ADR rejected, whereas what is being built is a feed. Anyone reaching for read state, a per-user
badge or a delete control should come back and amend this section first, because those are the
features whose absence is the reason the decision could be narrowed rather than reversed.

### Consequence added

- (−) Delivery and the feed are now two writes that have to agree. They are one operation on the
  send path for that reason. Splitting them later reintroduces the drift this avoids.

Related: the FCM section of `CLAUDE.md`, `docs/explanation/fcm-architecture.md` (the current
SSOT), and `docs/plans/fcm-push-notifications.md` (the superseded plan). The mini-app push
architecture the revisit sits inside is [ADR 0006](0006-miniapp-webview-push-architecture.md),
sections 6 to 8. The work is tracked in spencer0124/skkuverse#17.
