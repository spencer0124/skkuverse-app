---
title: FCM Push Notifications Plan
type: plan
status: superseded
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# FCM Push Notifications Plan

> The plan for building per-department push notifications, kept as a record that the work happened. The current architecture is [fcm-architecture.md](../explanation/fcm-architecture.md). Nothing here describes how the system works today.

> [!WARNING]
> Superseded. Every part of this plan either went live, was replaced, or was abandoned, and
> the knowledge that survived was moved into the documents linked below. The plan text
> itself was a working document that accumulated fifteen hundred lines of step-by-step
> instructions, half of which described code that has since been rewritten.

## What happened

| Stage | Outcome |
| --- | --- |
| Phase 1, FCM foundation | Client-side messaging, background handler, device registration, topic constants |
| Phase 2, Firestore integration | Preferences and device documents, security rules, the settings hook |
| Phase 3, subscription UI and badge | The settings screen, foreground handling, and the local unread badge |
| Phase 4, iOS notification service extension | Abandoned. The approach was dropped rather than deferred |
| Delivery | A general-purpose HTTP entry point the backend calls when a notice is published |
| Phase 5, v5 SSOT | Firestore became the single source of truth, with the server deriving topics from it |

The decisions from this period are recorded elsewhere, in the form they should be read in.

- **No notification inbox.** The badge is computed locally rather than backed by a stored
  message list. See [ADR 0002](../decisions/0002-no-notification-inbox.md).
- **Preferences replicate to devices through a trigger.** The reasoning, the incident that
  forced it, and the guards it needs are in
  [2026-04-fcm-preferences-devices-drift.md](../internal/2026-04-fcm-preferences-devices-drift.md).

## Where the knowledge went

| Topic | Now lives in |
| --- | --- |
| Current architecture, SSOT model, tabsContract, delivery, auth transition | [explanation/fcm-architecture.md](../explanation/fcm-architecture.md) |
| The preferences-to-devices drift incident and the trigger's operating guards | [internal/2026-04-fcm-preferences-devices-drift.md](../internal/2026-04-fcm-preferences-devices-drift.md) |
| App Check debug tokens on the simulator, and Play Integrity throttling | [explanation/app-check.md](../explanation/app-check.md) |
| Firestore debugging technique: snapshot metadata, REST server truth, `updateTime` drift | [how-to/firestore-debugging.md](../how-to/firestore-debugging.md) |
| Adding a notice tab across repositories | [how-to/add-notice-tab.md](../how-to/add-notice-tab.md) |

## The original text

The full plan, in Korean, is preserved in git rather than here:

```bash
git show fe0942c:docs/plans/fcm-push-notifications.md
```

A commit id is used deliberately. It is the one kind of value this repository's writing
rules allow a document to hardcode, because unlike a version number or a test count it
cannot drift.
