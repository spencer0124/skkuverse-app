---
title: FCM Preferences to Devices Drift
type: postmortem
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# FCM Preferences to Devices Drift

> Why toggling a notification category appeared to do nothing until the app was killed and relaunched, and why `syncPreferencesToDevices` exists. Read this before changing how preferences reach `devices/`, or before adding a second writer to that collection.

> [!NOTE]
> Salvaged from `docs/plans/fcm-push-notifications.md` when that plan was retired. The
> current architecture is [fcm-architecture.md](../explanation/fcm-architecture.md); this
> document is the incident that shaped one part of it.

## Symptom

Toggling a category in the notification settings screen updated the UI at once, but the
pushes that arrived afterwards still matched the old subscription. The new selection only
took effect after the app was killed and relaunched.

An earlier App Check fault produced a similar-looking symptom and was fixed first. This one
survived that fix, which is what made it worth a separate investigation. The App Check half
is written up in [app-check.md](../explanation/app-check.md).

## Root cause

`users/{uid}/preferences/main` and `devices/{deviceId}` both stored `subscribedTopics` and
`notificationsEnabled`. The duplication was deliberate: delivery queries devices by topic,
so the fields have to be on the device document for the send path to be a single query.

Replication was supposed to be a Firestore `onWrite` trigger. That trigger had never been
deployed. Nothing else wrote the mirror on the toggle path:

| Writer | When it runs | What it writes |
| --- | --- | --- |
| `updatePreferences()` | Every toggle | `users/{uid}/preferences/main` only |
| `registerDevice()` | Bootstrap, token refresh, auth transition | `devices/{deviceId}` |

So a toggle updated the source and left the mirror stale. Relaunching the app called
`registerDevice()` with fresh preferences, which copied them across, and the change appeared
to "finally" take effect.

Delivery targets devices, so the user's actual push subscription was whatever the mirror
last happened to hold.

## Evidence

Read over the REST API rather than the console, using the `updateTime` comparison described
in [firestore-debugging.md](../how-to/firestore-debugging.md):

| Document | `subscribedTopics` | `updateTime` |
| --- | --- | --- |
| `preferences/main` | `[academic]` | 10:53:34, matching the last toggle exactly |
| `devices/{deviceId}` | `[recruitment, scholarship, career, academic, event]` | 10:51:39, that session's bootstrap |

Two minutes of drift between two replicas of the same field was the whole diagnosis.

## Options considered

| Option | Approach | Cost | Covers other devices |
| --- | --- | --- | --- |
| A | Client-side mirror: `updatePreferences` writes `devices/{deviceId}` too | Minutes | Current device only |
| B | Deploy the `syncPreferencesToDevices` trigger, as originally designed | One CF plus its `onWrite` cost | Yes |
| C | A and B together: zero latency locally, the trigger propagates elsewhere | A plus B | Yes, with the lowest latency |
| D | Drop `devices.subscribedTopics`, make preferences the only source, join at send time | An architecture change | Yes, and drift becomes impossible |

## Decision

**Option B**, deployed the same day. Option A was skipped because the measured server
acknowledgement latency was fast enough to feel immediate, which removes the only advantage
C had. Option D remains the design that cannot drift, and is the one to revisit if a second
writer to `devices/` is ever proposed.

## Operating the trigger

The trigger's shape and settings are in
[fcm-architecture.md](../explanation/fcm-architecture.md). What that table does not carry is
why each guard is there.

| Risk | Defense in place | Still needs |
| --- | --- | --- |
| Retry amplification: a bug retried for days | Event age guard plus a capped `maxInstances` | A periodic look at the metrics |
| Admin SDK bypasses security rules | Query scoped by `uid`, and a whitelisted field update rather than a document write | Confirming both in review, every time |
| Diff guard false negative | Set comparison before writing | Re-checking when the preferences schema changes |
| A future trigger loop | Exactly one CF writes `devices/` today | Reviewing the write path whenever a second one is added |
| Artifact Registry build-up | A cleanup policy on the function's region | Nothing |
| Cloud Build minutes | Deploys are manual | A plan before deploys become automated |

Cost was projected at well under the free tier for both invocations and the Firestore reads
and writes the trigger causes, at the traffic level measured on the day it went live. Treat that as
an estimate from that date rather than a current figure: re-measure instead of trusting this
line. A small monthly budget alert on the billing account is what turns a runaway loop from
a monthly surprise into a same-day one.

## Related

- [fcm-architecture.md](../explanation/fcm-architecture.md) — the current architecture, including the trigger's configuration
- [firestore-debugging.md](../how-to/firestore-debugging.md) — the `updateTime` comparison and REST server-truth technique this used
- [app-check.md](../explanation/app-check.md) — the App Check fault that produced the same surface symptom
