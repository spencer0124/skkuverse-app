---
title: No Notification Inbox (Option D)
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# 0002. Push without a notification inbox (option D)

## Status

Accepted — 2026-04, decided while designing FCM push. Recorded 2026-07-21.

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

Related: the FCM section of `CLAUDE.md`, `docs/explanation/fcm-architecture.md` (the current
SSOT), and `docs/plans/fcm-push-notifications.md` (the superseded plan).
