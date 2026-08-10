---
title: Firestore Debugging
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# Firestore Debugging

> A working procedure for narrowing down "the write does not stick" and "the change does not show up" without misdiagnosing them. It runs in a fixed order, starting from the observation layer, then server truth, then replica drift.

> [!NOTE]
> This combines the three techniques established while debugging the FCM
> preferences-to-devices drift in 2026-04, with the symptom triage that came out of the
> 2026-07 notices picker ghost-state postmortem.

## Overview

The most common mistake in Firestore debugging is suspecting the code before noticing that
**the observation tool itself is lying**. A client `onSnapshot` hides the server
acknowledgement depending on its options, and even the Firebase console can be stale, since
it is a listener too. The procedure below forces the order: validate the observation layer,
get server truth, then localise the cause.

## Symptom triage, before opening any code

Narrow the candidates from the symptom pattern first. Source: the
[notices picker ghost-state postmortem](../internal/2026-07-notices-picker-ghost-state.md).

| Symptom | Verdict | Why |
| --- | --- | --- |
| The UI **shows the change briefly, then reverts** | The server rejected it, through rules | Firestore latency compensation applies the write optimistically to the local cache and rolls back when the server rejects. The write code ran, so the problem is the rules or the payload |
| **Nothing happens at all**, and the write is an `update()` | **The document does not exist** | `update()` is a patch and fails when the document is missing, and under rules that surfaces as `permission-denied`. Firestore disguises a missing document as a permissions problem |
| Writes to **other collections work in the same session** | Auth and App Check are **ruled out** | A token problem would not pick and choose collections. Narrow to that document or its rules |

> [!WARNING]
> Do not go straight to the rules when you see `permission-denied`. As the second row says, a
> **missing document produces the same error code**. Confirm whether the document exists with
> technique 2 first.

## Technique 1: `onSnapshot` hides the server ack without `includeMetadataChanges`

With default options, `onSnapshot` **emits nothing for a server acknowledgement or a
`fromCache` transition as long as the document contents are unchanged**. Seeing only the
optimistic local snapshot makes the write look like it never reached the server.

```ts
import { onSnapshot } from '@react-native-firebase/firestore';

// While debugging, always subscribe to metadata changes as well
const unsubscribe = onSnapshot(
  docRef,
  { includeMetadataChanges: true },
  (snap) => {
    console.log(
      'fromCache:', snap.metadata.fromCache,
      'hasPendingWrites:', snap.metadata.hasPendingWrites,
      'data:', snap.data(),
    );
    // hasPendingWrites going true -> false means the server ack arrived
    // fromCache going true -> false means a server snapshot replaced the cached one
  },
);
```

What to watch for:

- Only `hasPendingWrites: true` snapshots arrive and the `false` transition never comes, which
  means the write **never reached the server**, through offline queueing or an App Check token.
- The `false` transition arrives and then the value reverts, which means the server **rejected**
  it. That is the first row of the triage table.

## Technique 2: get server truth from the Firestore REST API

The Firebase console is a view drawn on its own listener, so it **can be stale**. To find out
what is really on the server, call the Firestore REST API directly. For auth, reuse the
refresh token firebase-tools has already stored locally.

```bash
# 1) Pull the refresh token firebase-tools saved
REFRESH_TOKEN=$(jq -r '.tokens.refresh_token' ~/.config/configstore/firebase-tools.json)

# 2) Exchange it for an access token. The client id and secret are firebase-tools'
#    public OAuth client, found in its auth module.
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="<firebase-tools-oauth-client-id>" \
  -d client_secret="<firebase-tools-oauth-client-secret>" \
  -d refresh_token="$REFRESH_TOKEN" \
  -d grant_type=refresh_token | jq -r '.access_token')

# 3) Read the document. createTime and updateTime come back with the fields.
#    Find <project-id> in .firebaserc or through `firebase use`.
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/users/<uid>/preferences/main" | jq
```

- A `404 NOT_FOUND` confirms the document is missing, which is the decisive evidence for the
  triage table's second row.
- Fields that differ from what the client observes narrow the problem to the client's
  listener or cache layer.

## Technique 3: judge replica drift by comparing `updateTime`

When a mirrored field goes out of step, as `preferences/main` does with `devices/*`, decide
which stage failed by **comparing the `updateTime` of the two documents**. Technique 2's REST
read returns it.

| Observation | Verdict |
| --- | --- |
| The source `updateTime` is fresh, the mirror is old | The source write succeeded. Investigate from the mirroring trigger, which either never fired or failed |
| The source `updateTime` is itself old | The **source write never arrived**. Go back to the client write path, technique 1 |
| Both are fresh but the values differ | A bug in the trigger's field mapping or whitelist |

## Verify rules with the emulator, never by deploying

> [!WARNING]
> Never deploy to production to test a hypothesis about the rules. A deploy reaches every user
> at once, and the slow verification loop cements a misdiagnosis. The local emulator is the
> instrument.

```bash
# Firestore rules tests, from the root, which starts the emulator itself
yarn test:rules

# CF trigger integration checks, from functions/
cd functions && npm run verify:trigger
```

- Commit new or changed rules cases to `apps/mobile/firestore.rules.test.mjs`, and trigger
  scenarios to a verify script under `functions/scripts/`, so both are reusable. The
  `verify:*` scripts in `functions/package.json` list what exists.
- Run `firebase deploy --only firestore:rules` only after those are green.

## Related

- [The 2026-07 notices picker ghost-state postmortem](../internal/2026-07-notices-picker-ghost-state.md)
  — the real case the triage table came from
- [FCM architecture](../explanation/fcm-architecture.md) — the preferences SSOT, the derive
  trigger, and how replication is structured
- [docs/README.md](../README.md) — the writing rules
