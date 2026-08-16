---
title: FCM Notifications Architecture
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-16
audience: internal
---

# FCM Notifications Architecture

> The current architecture of push notifications. Covers the v5 SSOT, where what is recorded is intent and what is sent is derived, along with the tabsContract mirror, drift sync, the delivery path, and auth transitions. Read this before touching FCM code.

> [!NOTE]
> This document supersedes [`docs/plans/fcm-push-notifications.md`](../plans/fcm-push-notifications.md), which is now a short record that the work happened. This file is the SSOT for the current architecture. The troubleshooting history that used to live only in the plan was moved out before it was retired: see [`internal/2026-04-fcm-preferences-devices-drift.md`](../internal/2026-04-fcm-preferences-devices-drift.md), [`app-check.md`](app-check.md), and [`how-to/firestore-debugging.md`](../how-to/firestore-debugging.md).

## Overview

- **The stack** is FCM directly, through `@react-native-firebase/messaging`, with
  `@notifee/react-native` for local display and badges.
- **State of the work:** phases 1 to 4, covering tokens, deep links, badges and the delivery
  CF, plus the phase 5 SSOT from 2026-04-25, are all done. The `onboardedAt` field arrived on
  2026-04-28.
- **Option D.** Notifications are delivered without an inbox, so there is no per-user
  notification record. The notices tab already holds the full history, so a push is
  fire-and-forget, and unread visibility comes from the
  app icon badge on the OS side and the tab bar badge inside the app. Both are local counters
  in Zustand and Notifee. The reasoning is in
  [ADR 0002](../decisions/0002-no-notification-inbox.md).
- **On-device diagnosis** is the debug logs screen, `apps/mobile/app/settings/debug-logs.tsx`,
  reached from settings, which shows the current FCM token next to the `devLog` buffer. It is
  the only diagnostic surface in the app: the standalone FCM debug screen was deleted after its
  entry button went away and left it unreachable. Verifying the server
  half is a separate path — see [How to verify](#how-to-verify).
- **Where data lives:** user data such as devices and preferences goes to Firebase, meaning
  Firestore and Auth. Public data such as notice bodies goes to MongoDB, behind the backend
  API.

## The principle: what is recorded is intent, what is sent is derived

The client **records intent only**, and the server, a Cloud Function, **derives** the actual
send targets, the topics. The Firestore document `users/{uid}/preferences/main` is the single
source of truth.

### The intent fields a client writes

A client writes only these. The schema authority is
`apps/mobile/src/services/firestore-notifications.ts`:

| Field | Type | Meaning |
| --- | --- | --- |
| `enabled` | `boolean` | The master toggle |
| `categoryEnabled` | `{ essential, services, notices }` | Per-category toggles |
| `noticeTabEnabled` | `Record<string, boolean>` | Per-notice-tab toggles |
| `pickerSelections` | `Record<string, string[]>` | Selections on a picker tab, such as departments |
| `onboardedAt` | `Timestamp \| null` | The onboarding-complete discriminator, described below |

### Derivation, in the `onPreferencesWrite` CF

- Triggered by an onWrite on `users/{uid}/preferences/main`. Second generation,
  `asia-northeast3`, Node 22, in `functions/src/triggers/onPreferencesWrite.ts`.
- Derives `subscribedTopics` and `derivedAt` from the intent and writes them back to the same
  document, in `functions/src/notifications/derive.ts`.
- **`onboardedAt` is not an input to derivation.** It is absent from the four intent fields
  Guard 1 compares: `enabled`, `categoryEnabled`, `noticeTabEnabled` and `pickerSelections`.
- **Guards, in two layers.** Unchanged intent means skip, which stops the self-loop from the
  function's own write. A derived result equal to what is already there also means skip,
  which drops the idempotent write.

### What the Firestore rules do

- **Derived fields are closed to client writes**, meaning `subscribedTopics` and `derivedAt`.
  A client can touch intent alone.
- **`onboardedAt` is one-way immutable**: null to a timestamp is allowed, and any later change
  is rejected. The cases are in `apps/mobile/firestore.rules.test.mjs`.
- The rules themselves are `apps/mobile/firestore.rules`, deployed with
  `firebase deploy --only firestore:rules`.

### The client write APIs

All in `apps/mobile/src/services/firestore-notifications.ts`:

| API | Field it touches |
| --- | --- |
| `setMasterEnabled` | `enabled` |
| `setCategoryEnabled` | `categoryEnabled.<key>` |
| `setNoticeTabEnabled` | `noticeTabEnabled.<key>` |
| `setPickerSelectionRemote` | `pickerSelections.<key>` |

**Every one is a single dot-path `updateDoc` with no transaction.** The reason is to keep the
Firestore SDK's offline write queue working in a campus wifi dead spot, since a transaction
fails immediately when offline.

### The `onboardedAt` discriminator

- `seedOnboardingPreferences` seeds `onboardedAt: serverTimestamp()` when the onboarding
  wizard completes.
- The default document written by `initializeFirestoreNotifications` leaves it `null`.
- Signing in on a second device uses `onboardedAt != null` as the discriminator for restoring
  automatically, which lifts the onboarding gate. The details are in the notices onboarding
  gate section of the root `CLAUDE.md`.

### The MMKV and Firestore boundary

| Store | Contents |
| --- | --- |
| MMKV, device-local | `token`, `deviceId`, `unreadCount`. Only device-local state is persisted |
| Firestore | `preferences`. The onSnapshot listener is the single source, and no local copy is treated as the SSOT |

## tabsContract, the mirror of the server's tab keys

`functions/src/notifications/tabsContract.ts` mirrors the notice tab keys by hand, as a fixed
set and a picker set. **The file itself is the authority on the current list.**

- **The source of truth is in another repo**, at
  `skkuverse-server/src/notices/categories.json`. When the backend adds a tab, this mirror
  has to be updated **in the same release**.
- Derivation detects an unknown **picker** key and logs it at warn level. An unknown **fixed**
  key cannot be detected at all, so that one rests on coordination between developers.
- **The convention is that a picker tab key is its topic prefix**, an identity mapping. The
  old `pickerPrefixForTabKey` conversion function has been removed.

## Drift sync: `syncPreferencesToDevices`

The Cloud Function that stops preferences and devices drifting apart on their replicated
fields, resolved on 2026-04-23.

| Item | Value |
| --- | --- |
| Trigger | onWrite on `users/{uid}/preferences/main` |
| Runtime | Second generation, `asia-northeast3`, Node 22 |
| Behaviour | Whitelist-updates **only `subscribedTopics` and `notificationsEnabled`** on every active device for that uid |
| Measured latency | About 0.3 seconds |
| Settings | `retry: true`, a 10-minute event age guard, and `maxInstances: 10` |
| Comparison | A before-and-after diff of the sets, which skips an unnecessary write |
| Permissions | The Admin SDK, which bypasses the security rules |
| Code | `functions/src/sync-preferences-to-devices.ts` |

For why each of this trigger's guards exists, and the incident that produced it, see [`internal/2026-04-fcm-preferences-devices-drift.md`](../internal/2026-04-fcm-preferences-devices-drift.md).

## The delivery path: `sendNotification`

The general-purpose HTTP entry point the backend Node server calls when it publishes a
notice. Phase 4, deployed 2026-04-23.

- **Shape:** the `sendNotification` HTTP CF (second generation, `asia-northeast3`, Node 22)
  plus the internal `handleNoticeNotification` handler.
- **Endpoint:**
  `https://asia-northeast3-skkubus-95723.cloudfunctions.net/sendNotification`
- **Authentication:** the `X-API-Key` header against Secret Manager's `FCM_API_KEY`, bound
  with `defineSecret`, compared with `timingSafeEqual`, and **defended with `.trim()`** in
  case the secret value carries a trailing newline.
- **The devices query needs a composite index**, declared in
  `apps/mobile/firestore.indexes.json` over `active`, `notificationsEnabled` and
  `subscribedTopics`.
- **The payload** builds FCM `data` as a `Record<string, string>`, dropping any optional
  field that is `undefined`, which protects against FCM v1 API validation. The payload
  contract shared with the backend, `NoticeNotificationPayload`, lives in the other repo.
- **Structured logging:**
  `logger.info('notice.dispatch.complete', { noticeId, topics, deviceCount, sent, failed, cleanedUp, durationMs })`,
  which makes a `jsonPayload.noticeId="..."` filter in Cloud Logging enough to trace one
  dispatch.
- **The code:** `functions/src/send-notification.ts`, `functions/src/handle-notice.ts`,
  `functions/src/channels.ts`, `functions/src/types.ts`.

### The token cleanup policy, which is critical

The `TOKEN_CLEANUP_CODES` allowlist holds **two codes and no more**:

- `messaging/registration-token-not-registered`
- `messaging/invalid-registration-token`

`messaging/invalid-argument` is **deliberately excluded**. That error can be about the whole
payload rather than the token, so allowlisting it turns one malformed payload into hundreds
of healthy devices flipped to `active: false`.

## Auth transitions between an anonymous and a Google uid

The fix for a bug where switching between anonymous and Google auth left
`devices/{deviceId}.uid` stale and produced `firestore/permission-denied`. Task #12, extended
2026-04-25.

- **Detecting and re-running.** `onAuthStateChanged` in
  `apps/mobile/src/hooks/useAppInit.ts` notices a uid change through
  `authStore.lastKnownUid` and re-runs `initializeFirestoreNotifications()`. The `withRetry`
  closure resolves the uid lazily with `getAuth().currentUser?.uid`, so it stays race-safe
  even when the uid changes again mid-retry.
- **Signing out.** `signOutFromGoogle` in `apps/mobile/src/services/google-auth.ts` calls
  `unregisterDevice(deviceId)` to mark the document `active: false` **before** signing out.
- **The anonymous-to-Google mirror**, added 2026-04-25. Both `OnboardingScreen.handleSignIn`
  and `handleSignIn` in `apps/mobile/app/login.tsx` follow the same pattern:
  `unregisterDevice` **before** signing in, and `await initializeFirestoreNotifications`
  **after**. That lets the rule's claim path succeed and closes the initialisation race.
- **Rule semantics.** A devices document is **owner-only while active, and claimable by any
  authenticated user while inactive**. The security trade-off is explained in the SECURITY
  TRADE comment in `apps/mobile/firestore.rules`, and the cases are in
  `apps/mobile/firestore.rules.test.mjs`. The rules are deployed to the `skkubus-95723`
  production project.

## How to verify

| Target | Command | Notes |
| --- | --- | --- |
| The derive trigger, end to end | `cd functions && npm run verify:trigger` | Runs on `firebase emulators:exec`. `functions/scripts/verify-trigger.ts` is the authority on the scenarios |
| Firestore rules | `yarn test:rules`, from the root | The Firestore emulator with `node --test`. `apps/mobile/firestore.rules.test.mjs` is the authority on the cases |

> [!WARNING]
> Never use a real deploy to verify a trigger or the rules. The emulator path is the rule, and
> a deploy comes after verification is green.

## Where the code is

| Role | Path |
| --- | --- |
| Tab key mirror and derivation | `functions/src/notifications/tabsContract.ts`, `functions/src/notifications/derive.ts` |
| The derive trigger | `functions/src/triggers/onPreferencesWrite.ts` |
| Drift sync | `functions/src/sync-preferences-to-devices.ts` |
| Delivery | `functions/src/send-notification.ts`, `functions/src/handle-notice.ts`, `functions/src/channels.ts`, `functions/src/types.ts` |
| The client Firestore layer | `apps/mobile/src/services/firestore-notifications.ts` |
| The notification settings UI | `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx` |
| Auth transitions | `apps/mobile/src/hooks/useAppInit.ts`, `apps/mobile/src/services/google-auth.ts`, `apps/mobile/app/login.tsx` |
| Rules, tests and indexes | `apps/mobile/firestore.rules`, `apps/mobile/firestore.rules.test.mjs`, `apps/mobile/firestore.indexes.json` |
| Verification scripts | `functions/scripts/verify-trigger.ts` |
| The on-device debug logs screen | `apps/mobile/app/settings/debug-logs.tsx` |

## Related

- [internal/2026-04-fcm-preferences-devices-drift.md](../internal/2026-04-fcm-preferences-devices-drift.md) — why preferences replicate to devices through a trigger, and how to operate it
- [plans/fcm-push-notifications.md](../plans/fcm-push-notifications.md) — the superseded plan, kept as a record
- [app-check.md](app-check.md) — preparing the App Check token before a Firestore write, through `primeAppCheck`
- [internal/2026-07-notices-picker-ghost-state.md](../internal/2026-07-notices-picker-ghost-state.md) — the ghost preferences postmortem, caused by a failed seed write
- [ADR 0002](../decisions/0002-no-notification-inbox.md) — push without an inbox
- [how-to/add-notice-tab.md](../how-to/add-notice-tab.md) — the cross-repo procedure for adding a tab, including the mirror update
