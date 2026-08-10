---
title: Notices Picker Ghost State Postmortem
type: postmortem
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# Postmortem: saving in the department picker did nothing (ghost preferences state)

| | |
| --- | --- |
| **Date** | Accumulating from around 2026-04-25, reported 2026-07, fixed 2026-07-18 |
| **Status** | Resolved. The fix is merged (`3e3cbca`, dev) and awaiting release |
| **Detection** | One user report, with an Android screen recording. Monitoring missed it: the labels had been piling up in Crashlytics for 90 days with nobody reviewing them |
| **Trigger** | The onboarding Firestore seed write failed, through the Play Integrity -8 throttle among other causes, and a catch swallowed it silently |
| **Root cause** | First, the local completion gate was committed before the server write, which created the ghost. Second, the self-healing seed used `essential:false` while the rules enforced an ESSENTIAL LOCK, which killed the recovery path and made the ghost permanent |

## TL;DR

When onboarding's Firestore seed failed quietly, the user ended up marked "onboarding
complete" with no `preferences/main` document, which is the ghost. Every later `update()`
from the department picker then failed, and the screen stayed pinned to its fallback, the
architecture department. The escape hatch, a self-healing create, violated the rules with
`essential:false`, so it had never once succeeded. It was dead code. Over 90 days
there were 25 ghosts, 7 of whom reached the visible symptom. The fix makes `essential`
consistent, commits the completion gate only after the write succeeds, and self-heals
outside the permission gate so existing ghosts recover on their own.

## Impact (Android 3.5.1, 90 days of Crashlytics)

| Measure | Value |
| --- | --- |
| Ghosts created (`onboarding/finalize` failures) | **25 users**, 97 events |
| Reached the symptom, a failed picker save (`notifications/picker-set`) | **7 users**, 32 events |
| Dead self-heal collisions (`notifications/init`, `register`, `post-signin`) | 78 users, 231 events |
| Play Integrity throttling (`app-check-refresh` -8) | 82 users, 266 events |
| Duration | About 84 days, from the rules change on 2026-04-25 to the fix on 07-18 |
| Collateral | A thrown prefs create cascaded into `registerDevice`, so push device registration was skipped |

## Timeline

| Time | Event |
| --- | --- |
| 04-25 10:20 | The bootstrap default document is written with `essential:false` (`ecd4a7c`) |
| 04-25 13:55 | The rules gain the ESSENTIAL LOCK (`ded4a4b`). The existing default is not updated, which **kills self-healing** |
| 04-25 to 07 | Ghosts accumulate, with Crashlytics labels piling up unnoticed |
| 07-18 | A user report and screen recording arrive, leading to diagnosis and the fix commit `3e3cbca`, pushed to dev |
| — | After release: confirm the permission-denied labels disappear |

## Root cause, five whys

1. **Why does pressing complete change nothing?** There is no `preferences/main` document, so
   `update()`, which is a patch, fails every time. Under rules that surfaces as
   permission-denied, which is Firestore disguising a missing document.
2. **Why is there no document?** The onboarding seed write failed, but `completeOnboarding()`
   in MMKV had already run, leaving the branch "complete locally, absent on the server". The
   catch logged and carried on.
3. **Why did the seed fail?** `primeAppCheck()` force-refreshed the token on every write, so
   onboarding, which is a burst of writes, hit the Play Integrity -8 throttle, and a write
   during the moment no token was available was rejected.
4. **Why did self-healing not save it?** The recovery create used `essential:false` while the
   rules demanded `essential==true`. The rules were tightened three and a half hours later
   without updating the existing seed, which is the regression. The deny fixture in the rules
   tests had the same shape as the production seed, and nobody connected the two.
5. **Why did 84 days pass unnoticed?** Every failure was recorded only as a non-fatal label,
   with no user feedback, and there was no habit of reviewing non-fatal errors.

That failure propagates: no document means `onSnapshot` yields `null`, so the store falls
back to defaults, so `resolvePickerSelection` reaches its last fallback of `sources[0]`,
which is the alphabetically first department and shows as the architecture department every
time.

## Resolution

Fix commit `3e3cbca`, five files, +215/−52, with tsc, lint, tests and all rules cases green:

| Kind | Change |
| --- | --- |
| Root cause (P0) | The self-healing seed changes `essential` from `false` to `true` |
| Prevention (P1, P2) | `completeOnboarding()` moves to **after** the Firestore write succeeds, with an alert and a retry on failure. The seed gains `withRetry`, and the two silent skips gain logs |
| Prevention (P3) | `ensurePreferencesDoc` is separated, decoupling a prefs failure from device registration, and `finalizeOnboardingAccepted` becomes idempotent |
| Recovery (S1, S2) | `onAuthStateChanged` guarantees the document regardless of notification permission, and restores the department selection left in MMKV, so **an existing ghost recovers by itself on the first launch after updating** |
| Regression guard (S4) | The rules tests gain a production-mirror create-then-allow guard |

## What went well and what went wrong

**Well**

- The ACCEPT path already had the alert-and-retry discipline, and the measurements bear that
  out: on that path (`seed-intent`) all 29 affected users recovered on the first try, while
  the silent path (`finalize`) produced 25 ghosts. The fix is that discipline copied across.
- The latency-compensation knowledge now written up in
  [`how-to/firestore-debugging.md`](../how-to/firestore-debugging.md) ruled out half the
  hypotheses immediately.

**Wrong**

- Recording state locally and on the server was neither atomic nor loud on failure, which is
  what made a ghost possible.
- Tightening the rules without checking the payloads existing clients send killed the
  recovery path for 84 days.
- Hundreds of non-fatal labels accumulated and nobody looked at them.

## Action items

- [x] Fix commit pushed to dev (`3e3cbca`), 07-18
- [ ] **Release it.** Automatic ghost recovery depends on the release, so this is the top
      priority
- [x] **P5: ease the `primeAppCheck` throttle** (`78985ee`), with a five-minute cache and
      everything merged into the single `app-check-prime.ts` module, replacing the three
      copies in notifications, bookmarks and feedback. Crashlytics labels consolidate under
      `app-check/refresh`
- [ ] After release, check Crashlytics: the permission-denied labels should disappear, and
      the new labels `ensure-prefs` and `complete-no-uid` should not appear
- [ ] End to end: run a DECLINE onboarding on an Android beta profile build, which is the only
      way to exercise the real Play Integrity path, then verify the picker saves
- [ ] Process: make reviewing non-fatal errors a weekly habit
- [ ] Optional. S3: give the user feedback when a picker write fails. P4: skip the
      pre-create during onboarding

## Appendix: where the code is

`firestore-notifications.ts` for `DEFAULT_PREFS`, `ensurePreferencesDoc`, and the seed and
finalize paths. `firestore.rules` for the ESSENTIAL LOCK, and `firestore.rules.test.mjs` for
the production-mirror guard. `OnboardingScreen.tsx` for the ordering invariant in
`handleComplete`, `useAppInit.ts` for the self-heal, and
`packages/shared/notices/picker.ts` for the fallback ladder.

The triage this produced now lives in
[`how-to/firestore-debugging.md`](../how-to/firestore-debugging.md): a change that appears
then reverts means the server rejected it, no reaction at all with an `update()` means the
document is missing, and writes working in other collections rules out auth and App Check.
