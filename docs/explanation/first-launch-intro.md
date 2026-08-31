---
title: First-Launch Intro
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-28
audience: internal
---

# First-Launch Intro

> The four-page value tour (`apps/mobile/src/features/intro/`) shown once to every user who is not signed in with a Google account. Why it is a gate inside `InitGate` rather than a route, what decides when it appears, and how it changes the notices wizard that runs later.

## The problem it solves

The app used to never pitch itself. A user installed it, landed on a tab, and the only
surface that asked for a Google account was the notices tab gate — which markets one
feature, AI-summarised notices, and is reachable only by opening that tab. A user who never opened it
never saw a reason to sign in, and stayed anonymous indefinitely. Nothing anywhere
marketed the shuttle timetable or the campus map at all.

The intro puts the three things the app is actually good at in front of every user, then
asks for the account at the end, where the ask has been earned.

## Two onboardings, two flags

These are easy to confuse and are not the same thing.

| | First-launch intro | Notices wizard |
| --- | --- | --- |
| Code | `src/features/intro/` | `src/features/onboarding/` |
| Pages | 4: shuttle, campus map, AI notices, sign-in | 7: campus, primary dept, interest depts, sign-in, notifications, categories, done |
| Audience | Everyone not signed in with Google | Anyone opening the notices tab ungated |
| Flag | `introSeen` | `onboardingCompleted` |
| Mount | A branch of `InitGate` | The `/onboarding` fullScreenModal route |
| Skippable | Yes, via the skip link | No |

`introSeen` leaves the notices tab locked, deliberately. Skipping the intro leaves a
user anonymous and un-onboarded, and they still meet `OnboardingLanding` and the wizard
when they open notices.

## When it appears

`InitGate` decides once, and the condition is `isAnonymous && !introSeen`.

The subtlety is *when* it is safe to read `isAnonymous`. `authStore` defaults it to `true`
and only learns the truth when `onAuthStateChanged` fires, which lands **after**
`useAppInit` sets `isReady`. Deciding on `isReady` alone would flash the tour at a
signed-in user. So the gate also waits on `authStore.isInitialized`, which is set by
`setAuthenticated` / `setUnauthenticated` and is the honest signal that Firebase has
answered. This is the first code in the app to read that flag; the notices tab predates it
and instead defends against the same flicker by re-asserting `headerShown` on both
branches.

A `useRef` freezes the decision after it is taken. Signing in on the last page flips
`isAnonymous` to `false`, and without the freeze the gate would tear the intro down
mid-flow, before `onDone` runs.

## Why a gate and not a route

`IntroScreen` **replaces** `children` inside `InitGate`, the same way `ForceUpdateScreen`
does. It is not an expo-router route and has no `Stack.Screen`.

- A route would have to be pushed once the navigation root is ready, which is the race the
  three `Pending*LinkConsumer` components in `app/_layout.tsx` exist to work around. A
  gate has no such timing to get wrong.
- A route is a deep-link surface. `/onboarding` is already on the blocklist in
  `app/+native-intent.tsx` for exactly this reason; not existing as a route is stronger
  than being blocked.
- Replacing `children` rather than overlaying them means the tab tree never mounts behind
  the intro — no `screen_view` for tabs nobody has seen, no queries warmed for a user who
  may never arrive.

A cold-start deep link still survives the detour: `+native-intent` stashes it in a module
singleton before the tree mounts, and the consumers drain it on mount, which now simply
happens when the intro dismisses.

The splash stays layered above both so the splash → intro handoff has no white flash.

## Sign-in is the last step

`IntroScreen.handleSignIn` uses the same `signInWithDeviceMigration` all other entrypoints
use (scope `'intro'`), then calls `classifyAndRestoreOnboarding` — but **ignores the
result for routing**. It closes the intro either way.

The call is kept for its side effect: on a returning user it mirrors `onboardedAt` and the
department list from Firestore into MMKV, so the notices tab opens straight into notices
instead of gating a user who already onboarded on another device. Dropping the call would
eventually self-heal through the `onPreferencesChanged` listener in `useAppInit`, but only
after a visible flicker of the gate.

Nothing routes onward to `/onboarding`. A new user meets the notices wizard later, on
their own terms, when they open the notices tab.

## What the intro changes about the wizard

A user who signed in during the intro must not be asked to sign in again three screens
later. `OnboardingState` gained `skipLogin`, set once in the wizard's lazy initializer
from `authStore`, and the reducer gained two branches:

- `NEXT` from 3 goes to 5 instead of 4
- `PREV` from 5 goes to 3 instead of 4

`skipLogin` is read **once, at mount** and never live. Reading `isAnonymous` live would
change the ladder underneath a user the moment step 4 succeeded.

The step-7 title greets the user by name, which normally arrives from step 4's `SET_USER`.
The lazy initializer seeds `userName` from `authStore.displayName` so a skipped login does
not fall back to the generic label.

Everything downstream already held: `prepareCategoryStep` and `handleComplete` read
`authStore.getState().uid`, which is non-null precisely when `skipLogin` is true.

`OnboardingLanding` also hides its "이미 가입한 적 있어요" link for a user who is <!-- conventions:allow-korean: the shipped link label -->
already signed in. The intro can leave someone signed in yet un-onboarded, and the gate
still shows for them. Tapping the link there would start a second sign-in against the
account they are on.

## The reducer moved out

`reducer` and `initialState` used to be inline in `OnboardingScreen.tsx`, which imports
React Native, so `node --experimental-strip-types --test` could not load them. They now
live in `src/features/onboarding/reducer.ts`, whose only import is type-only and so gets
erased — the same property that makes `campusProximity.ts` testable.

`MAX_INTEREST_DEPTS` moved there too, and not only for tidiness: a value import of
`./types` would reintroduce a relative runtime specifier that Node's ESM resolver cannot
resolve without a file extension. Any value the reducer needs has to live beside it.

`reducer.test.mts` covers all three non-linear transitions, including the case where a
user both skipped login and declined notifications and so takes both detours in sequence.

## Illustrations are drawn in code

`src/components/previews/` holds mock cards built from `View` and `Text`. No image assets.
`NoticePreviewCard` is the card the notices gate already showed, extracted so the two
surfaces cannot drift; `ShuttlePreviewCard` and `MapPreviewCard` are new and follow its
visual language through the shared `previewCard` style.

Card *internals* stay hardcoded Korean, matching the reasoning the notices gate has always
carried: one rich concrete example sells the feature better than a placeholder. Headlines,
bodies and CTAs are i18n'd under `intro.*` in all three locales.

The sign-in page instead shows `IntroEmojiField` — the same drifting Tossface cluster the
home `HeroBanner` uses, re-scattered for a canvas five times taller. The motion lives in
the shared `src/components/FloatingEmoji.tsx`, extracted from `HeroBanner` for the same
anti-drift reason as the notice card. Its four emoji are the four things the body copy
names, so the picture and the list say one thing rather than two.

The field is square (`aspectRatio: 1`) rather than filling the figure. Absolute children
position off the parent, so stretching to the full height pulls the cluster into four
unrelated corners instead of one loose group. The staggered `delay` per emoji matters for
the same reason the home banner has one: without it four emoji rise in unison and read as
one moving block.

## Paging

A plain `ScrollView horizontal pagingEnabled`, not `react-native-pager-view`. Adding that
library is a native dependency, which costs a prebuild and a `runtimeVersion` bump, for a
horizontal snap the platform already does. As built, the whole feature is OTA-publishable.

Pages must avoid `flex: 1`, which is easy to reach for and wrong here. Inside a horizontal
ScrollView it sets `flexBasis: 0` on the main axis and fights the explicit page width,
collapsing every page. `IntroPage` sets `width` only and lets the content container stretch it vertically.
Horizontal padding lives on the page rather than a parent, because the ScrollView has to
run edge-to-edge for paging to snap on the window width.
