---
title: Notices Picker Ghost State Postmortem
type: postmortem
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-09-01
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
- [x] **S3: give the user feedback when a picker write fails** (2026-09-01). Marked optional
      here, and that turned out to be the single reason this bug shipped twice — see the
      recurrence section below. P4 (skip the pre-create during onboarding) is still open

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

## Recurrence: 2026-09-01

Reported again, in the same words: "공지-학과선택에서 학과를 선택해도 건축학과에서 타 과로
바뀌지 않아요." Two days after Release 3.6.0 (`ota/prod/2026-08-30T2026`).

**Not a revert.** Every fix from 2026-07 was still present on `dev` and `main`: the
`essential: true` seed, the ordering-invariant comment, the `useAppInit` self-heal, the
prod-mirror rules test. The bug returned through the gap those fixes left open.

### What we got wrong the first time

**1. The failure was still silent.** The one action item marked *optional* above — tell the
user when a picker write fails — was the difference between a bug that reports itself and one
that waits for a user to notice. `handleConfirm` was fire-and-forget with an unconditional
`router.back()`, so a failed save was pixel-identical to a successful one. That is the whole
reason the recurrence had to be reported by a human rather than by Crashlytics.

**2. The 2026-08-19 self-heal was dead code, in the same way the 2026-07 seed was.**
`setMiniAppSubscribed` gained a NOT_FOUND fallback (`7234bb1`) that tested
`code !== 'firestore/not-found'`. A missing document does not surface as `not-found`: the
`allow update` rule dereferences `resource.data`, `resource` is null when the document is
absent, and the client is told **`permission-denied`**. So the fallback had never once fired.

This is exactly the shape of the original root cause — a recovery path structurally incapable
of running — and it was reintroduced within a month of fixing it, because nothing in the repo
asserted the error *code*. There is now a test that does:
`firestore.rules.test.mjs` → "update() on a MISSING preferences doc → deny with
permission-denied (not not-found)". **Do not narrow `isMissingPrefsDocError` back to
`not-found` without changing that test first.**

**3. The ordering invariant was prose, and prose has an `else` branch.** `handleComplete`
honoured it inside `if (uid)` but the no-uid branch logged and fell through to
`completeOnboarding()`, which sat *outside* the if/else — deliberately minting a ghost and
trusting the `useAppInit` self-heal. That self-heal is `!user.isAnonymous`-gated, un-awaited,
and lives inside `onAuthStateChanged`, which Android's `linkWithCredential` never fires
because it preserves the uid. The promised recovery could not run on the one path that needed
it most.

**4. A third state nobody had named.** The picker modal seeded its edit buffer from
`resolvePickerSelection` — the *resolved fallback*, not the *stored* value. So the modal
opened with 건축학과 pre-checked, the user added their own department, and the save
**succeeded**, persisting `['arch', <theirs>]`. A display fallback laundered into stored
intent. This needs no failed write at all, and it fits the reported wording better than the
ghost state does.

### What shipped (2026-09-01)

| File | Change |
| --- | --- |
| `packages/shared/src/notices/prefsWriteErrors.ts` | `isMissingPrefsDocError` — treats `permission-denied` as recoverable, with the reasoning |
| `apps/mobile/src/services/prefs-self-heal.ts` | `writeWithSelfHeal` — one recovery point; **all five** `preferences/main` writers route through it |
| `apps/mobile/app/notices/picker.tsx` | awaits the write, keeps the modal open on failure, Toast + retry; edit buffer seeds from *stored* |
| `packages/shared/src/notices/picker.ts` | rung 3 kept (never blank the tab) but instrumented via `onFallback` |
| `apps/mobile/src/features/onboarding/completion.ts` | `decideOnboardingCompletion` — no-uid now aborts instead of minting a ghost |
| `apps/mobile/src/services/auth-flow.ts` | unconditional `ensurePreferencesDoc` after sign-in, closing the Android link gap |
| `apps/mobile/src/services/google-auth.ts` | the uid-orphaning link fallback is logged instead of `console.warn` |
| `functions/scripts/backfill-prefs.ts` | audit + repair for existing ghosts; `--dry-run` yields the impact number |

### Measured impact of the recurrence (2026-09-01)

`backfill-prefs.ts --dry-run` against production, which is the count nobody had
in 2026-07:

| | |
| --- | --- |
| Auth users scanned | 8,552 |
| Google-linked (candidates) | 1,133 |
| **Ghosts — no `preferences/main`** | **45** (~4% of signed-in users) |
| Repaired (`--apply`) | 45 created, 0 failed, re-audit confirms 0 remaining |

**Crashlytics undercounted by 9x.** `notifications/picker-set` showed 5 affected
users; the real dead-write population was 45. A ghost who never opens the picker
never generates an error, so the error log can only ever show the subset who hit
the symptom AND reported it. Any future estimate of a silent-failure population
should come from a census like this one, not from the non-fatal count.

Note what the repair does and does not do: it restores the ability to save. It
does not restore anyone's department, because the only copy of that lives in the
device's MMKV. Those 45 users still see 건축학과 until they re-pick — but the
re-pick now persists.

### The lesson that generalises

Both root causes — 2026-07 and 2026-09 — were **recovery paths that could not execute**, and
in both cases the code read as though it handled the failure. A recovery path with no test
proving it runs is decoration. The rules test that pins the error code is the cheapest
insurance in this whole file, and it did not exist for the first 84-day incident or the
6-week gap that followed.

Second: 84 days passed the first time because nobody had a count. `backfill-prefs.ts --dry-run`
now produces one on demand.
