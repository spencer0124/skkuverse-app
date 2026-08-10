---
title: Notices Feature
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# Notices Feature

> How the notices tab (`apps/mobile/src/features/notices/`) is built and why. Covers the server-driven tab layout, custom markdown rendering, the dimension hint that removes layout shift, date grouping, and the onboarding gate with its automatic restore.

## Overview

The notices feature follows one principle. The server owns the layout, and the client owns
the rendering. Which tabs exist, in what order, and which picker sources they offer are all
decided by the server response. The client concentrates on drawing crawled markdown
reliably around React Native's constraints, such as an `Animated.View` being unable to live
inside `Text`, and the image server requiring a Referer header. Entry is gated behind
onboarding, and a new device or a reinstall restores automatically from the `onboardedAt`
discriminator in Firestore.

## Server-driven tab layout

`GET /notices/tabs` returns the entire tab configuration. **The server is the authority on
which tabs exist, how many, and in what order**, and the client renders the response as it
comes. At the time of writing that is nine tabs.

| What the server sends | Description |
| --- | --- |
| Tab kinds and order | Rendered into the strip in array order |
| `tabMode` | `fixed` for a single source, or `picker` for a multi-source selection |
| The picker source list | What a `picker` tab offers, such as the list of departments |
| `maxSelection` | The upper bound on a picker's multi-select |
| `defaultIds` and `campusDefaultIds` | Defaults when nothing is chosen, including a per-campus branch |

A `tabMode: "picker"` tab opens a multi-source picker UI, a BottomSheetModal with
multi-select. The server contract that mirrors these tab keys on the FCM side is
`functions/src/notifications/tabsContract.ts`, whose source of truth is `categories.json` in
the skkuverse-server repo.

## Markdown rendering with a custom NoticeRenderer

The renderer is `NoticeRenderer` in
`apps/mobile/src/features/notices/NoticeMarkdownView.tsx`, extending the `Renderer` from
`react-native-marked`. Check `apps/mobile/package.json` for the major version. Each of its
three overrides works around a constraint in React Native or in the notice data.

| Override | What it does | The constraint behind it |
| --- | --- | --- |
| `image()` | Renders through the `RefererImage` component | The SKKU image server requires a Referer header, and this is also where the dimension-hint shimmer placeholder is shown |
| `paragraph()` | A paragraph containing an image becomes a `<View>`, a text-only one a `<Text selectable>` | React Native refuses to run an `Animated.View` inside `Text`, and the shimmer is one, so a paragraph carrying an image is promoted to a View hierarchy |
| `link()` | A web link opens the in-app browser, while an email or phone link copies to the clipboard | Handles the `mailto:` and `tel:` links in notice bodies without jumping to an external app |

## The image dimension hint, which removes layout shift

The crawler embeds each image's original size in the markdown alt text, in the form
`![{WxH} alt](url)`. `parseDimHint()` in `NoticeMarkdownView.tsx` parses it, and:

1. With a hint, a shimmer skeleton of the exact size is shown as an overlay **before** the
   image loads, which removes the cumulative layout shift.
2. Without one, nothing appears until `Image.getSizeWithHeaders` finishes, since the size
   lookup needs the Referer header too.

## Notice rows and date grouping

**The row**, in `apps/mobile/src/features/notices/NoticeRow.tsx`:

- Toss-style left-aligned metadata reading "3 days ago · department name", where the
  department appears only on a multi-department tab.
- A paperclip icon beside the title when the notice has an attachment.
- A deadline badge when it has one, coloured by how many days remain.

**Date grouping** is `groupNoticesByDate()` in
`apps/mobile/src/features/notices/utils/groupNotices.ts`, which sorts notices into five
buckets rendered as `SectionList` headers:

| Bucket | Contents | Order |
| --- | --- | --- |
| `recent7` | The last 7 days | Top |
| `recent30` | The last 30 days | |
| `month-{n}` | By month within this year | Descending |
| `year-{n}` | By year, for earlier ones | Descending |
| `unknown` | Notices whose date failed to parse | After every year bucket and before the default. The priority value is in `groupNotices.ts` |

`unknown` is the fallback when `item.date` fails to parse as `YYYY-MM-DD`, whether it is an
empty string, an ISO timestamp, or malformed. It defends against the parser's
`asString(raw.date)` demoting a missing or null value to `''`. Its label is `기타` in Korean, <!-- conventions:allow-korean: the shipped label strings -->
`Other` in English and `其他` in Chinese.

## The onboarding gate and automatic restore

### The gate condition

The notices tab gate is `isAnonymous || !onboardingCompleted`, in
`apps/mobile/app/(tabs)/notices/index.tsx`. If either is true it shows `OnboardingLanding`.
An account has to be on the `@g.skku.edu` domain.

### The v2 gate screen (redesigned 2026-05-01)

A top-left aligned hook headline at 32pt bold, a mock notice card in the middle showing a
double-major deadline example, a dark green `#1f3d2e` CTA, and a secondary "I already have
an account" action. The mock card's copy is hardcoded Korean and deliberately not
internationalised, which is the prototype's scope. The CTA colour has no matching SDS Button
variant, so it is a custom inline Pressable.

While the gate is active the chrome is hidden so the screen can concentrate on sign-up. Both
pieces have to be **prevented from mounting rather than covered**, because of how they sit
in the native layer:

| Hidden | How | The native reason |
| --- | --- | --- |
| The tab strip header | The gate branch renders `<Stack.Screen options={{ headerShown: false }} />`, where the normal branch renders `header: () => <NoticesHeader />` | A native-stack header is **mounted in a separate layer** rather than as a sibling of the body, so an absolute overlay inside the body cannot cover it. Not mounting it is the only way |
| The bottom Search, Bookmarks and Filter accessory bar | The gate `showNoticesAccessory = isNoticesTab && !isAnonymous && onboardingCompleted` is hoisted to the parent `TabLayout` in `app/(tabs)/_layout.tsx`, which passes `bottomAccessory={... ? () => <NoticesBottomAccessoryGate /> : undefined}` | Returning `null` from the child still **leaves an empty Liquid Glass capsule taking up space**. Only making the prop itself `undefined` triggers `setBottomAccessory:nil animated:YES` and a real unmount |

### The restore paths, which are a dual write

- **The main CTA** pushes the five-step Toss-style wizard at `/onboarding`.
- **The secondary "I already have an account"** runs an inline Google sign-in handler,
  `handleExistingAccountSignIn` in `notices/index.tsx`, mirroring the pattern in `login.tsx`:
  unregister the anonymous device, sign in, re-register. After signing in it reads
  `getPreferences(uid)` explicitly, and when `prefs.onboardedAt != null` and
  `pickerSelections.dept.length > 0` it calls
  `useSettingsStore.restoreOnboardingFromRemote()` at once, so the gate lifts without a
  flicker. A user who is actually new, or corrupt state, is pushed to `/onboarding` instead.
- **The cold-start fallback** is the `onPreferencesChanged` listener in
  `apps/mobile/src/hooks/useAppInit.ts`, which calls the same restore logic. That lifts the
  gate on an ordinary launch by an already-authenticated returning user. It is a **dual write
  with the inline handler, and race-free**, because both always overwrite with identical
  data, which makes the order irrelevant.

### The `onboardedAt` discriminator

An explicit signal in Firestore at `users/{uid}/preferences/main`.
`seedOnboardingPreferences` in `apps/mobile/src/services/firestore-notifications.ts` seeds it
with `serverTimestamp()` when the wizard completes, and the default document written by
`initializeFirestoreNotifications` leaves it `null`. `apps/mobile/firestore.rules` enforces
**one-way immutability** from null to a timestamp, rejecting any later change. The tests are
in `apps/mobile/firestore.rules.test.mjs`.

### Always-overwrite semantics

`restoreOnboardingFromRemote` in `packages/shared/src/store/settings.ts` has **deliberately
no idempotency guard**. As an SSOT mirror it aims at eventual consistency: on an account
switch, signing out of A and into B, A's stale department heals itself to B's value. The
department mirror is `pickerSelections.dept[0]` as the primary, with `slice(1, 4)` as up to
three interests.

### The 'dept' key is hardcoded across three places

`onboardedAt` took over the discriminator role, but reading the department mirror is still
hardcoded in three sites. Renaming it **needs a coordinated change**:

| Site | Location |
| --- | --- |
| The inline sign-in handler | `apps/mobile/app/(tabs)/notices/index.tsx` |
| The cold-start listener | `apps/mobile/src/hooks/useAppInit.ts` |
| The server derive contract | `functions/src/notifications/tabsContract.ts` |

## Attachments

Attachments are served through a `files.skkuverse.com` proxy, with preview and download
buttons on the notice detail screen, in
`apps/mobile/src/features/notices/NoticeDetailScreen.tsx`.

## Related

- [deep-link.md](../reference/deep-link.md) — the whitelist contract, including notice deep
  links
- [fcm-architecture.md](fcm-architecture.md) — the preferences SSOT and tab subscription
  derivation, which is the server side of notice push
- [The 2026-07 notices picker ghost-state postmortem](../internal/2026-07-notices-picker-ghost-state.md)
  — what a failed onboarding seed did to preferences
