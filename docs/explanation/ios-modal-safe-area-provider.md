---
title: iOS Modal Routes Need Their Own SafeAreaProvider
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-16
audience: internal
---

# iOS Modal Routes Need Their Own SafeAreaProvider

> Why a route with `presentation: 'fullScreenModal'`, `'modal'` or `'formSheet'` has to be wrapped in its own `<SafeAreaProvider>`: the modal mounts in a separate UIViewController, so the root provider measures the wrong one. Read this before adding a modal route or changing a presentation.

## The problem

On a modal route's **first frame**, the content sits directly under the status bar or the
Dynamic Island, with no top safe-area padding. State changes inside the same modal look
fine, such as moving from step 1 to step 2 of a wizard rendered by the same parent, and
going back to step 1 looks fine as well, because UIKit has re-laid-out the view by then. So
the bug is that `top: 0` insets get baked into the first paint, even though every later
state change looks correct. It affects **every modal route**, not only onboarding.

## The mechanism

`presentation: 'fullScreenModal'` makes `react-native-screens` mount the route inside **a
separate native UIViewController**, with its own view hierarchy. What follows from that:

1. iOS computes `safeAreaInsets` per UIViewController. The modal's controller has its own,
   and they do not automatically match the (tabs) root controller's.
2. The **native** `<SafeAreaView>` from `react-native-safe-area-context` reads its own
   UIView's `safeAreaInsets` directly, rather than a React prop or context. During the modal
   animation the view bounds are not laid out yet, so the measurement returns
   `{top: 0, ...}`, and that value is what the first paint uses.

A root-level `<SafeAreaProvider>` cannot help, because it measures the **root** view, which
lives in a different hierarchy from the modal's controller. A consumer reading context
inside the modal receives values measured against the wrong controller.

> [!NOTE]
> **An honest caveat about the mechanism.** The exact native-level reason a modal-local
> provider fixes the timing race was not traced all the way through the
> react-native-safe-area-context and react-native-screens sources. Empirically the pattern is
> documented as effective across many GitHub issues describing this same symptom.

## The fix

Wrap the modal screen in its own `<SafeAreaProvider>`:

```tsx
// apps/mobile/app/onboarding.tsx
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export default function OnboardingRoute() {
  return (
    <SafeAreaProvider>
      <OnboardingScreen />
    </SafeAreaProvider>
  );
}
```

That mounts the `RNCSafeAreaProvider` native view **inside** the modal controller's view
hierarchy. The provider measures the modal controller's `safeAreaInsets` and broadcasts them
through React context, so every `<SafeAreaView>` and `useSafeAreaInsets()` consumer in the
modal subtree gets the right values.

### Upstream basis

- A react-navigation maintainer, in
  [react-navigation/react-navigation#11285](https://github.com/react-navigation/react-navigation/issues/11285):
  "you must render this [SafeAreaProvider] at the top of every screen that's backed by a
  native UIViewController (e.g. modals, stack navigators)".
- [Expo's react-native-safe-area-context docs](https://docs.expo.dev/versions/latest/sdk/safe-area-context/):
  "You may need to add it in other places too, including at the root of any modals when
  using react-native-screens".

### Fallback

If the modal-local provider misses some case, replace `<SafeAreaView edges={['top']}>` with
`useSafeAreaInsets()` and a manual `paddingTop`:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ModalLayout({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {children}
    </View>
  );
}
```

The hook subscribes to provider context and re-renders on a broadcast update, which sidesteps
the native SafeAreaView's timing-sensitive measurement of its own view.

### Routes to audit

Every route registered in `app/_layout.tsx` with `presentation: 'modal'`,
`'fullScreenModal'` or `'formSheet'`:

- `/onboarding` — **fixed, and the reason this document exists**
- `/login` — modal presentation
- `/sds-preview` — modal presentation
- `/notices/picker` — fullScreenModal presentation

Apply the same modal-local `<SafeAreaProvider>` wrap wherever the symptom appears.

### Keep the root SafeAreaProvider

The root `<SafeAreaProvider>` in `app/_layout.tsx` stays, for two reasons.

1. **Explicit beats implicit.** Both the react-native-safe-area-context guide and the Expo
   docs recommend a root provider as the standard pattern, and expo-router's implicit
   handling has documented inconsistencies
   ([expo/expo#28818](https://github.com/expo/expo/issues/28818)).
2. **A safety net for non-modal screens**, which may hit a measurement edge case later even
   if they have not yet.

The modal-local provider coexists with the root one rather than replacing it. Nested
providers are supported, and the nearest ancestor wins for each consumer subtree.

## What was deliberately not done

- **`<SafeAreaProvider initialMetrics={initialWindowMetrics}>` at the root.** The
  initial-render zero-inset race happens only at the provider's **first** mount, which is
  before the user has navigated to any modal. This bug is per-modal-mount timing rather than
  first-app-render timing, so `initialMetrics` would have treated an unrelated symptom.
- **Changing `presentation: 'fullScreenModal'` to a default push.** That changes the UX
  semantics from slide-up to push, and is unnecessary when a wrapper fix works.

## Related

- [ios-26-native-tabs-minimize.md](ios-26-native-tabs-minimize.md) — automatic contentInset
  on tab screens, a separate mechanism with a similar safe-area symptom
- [docs/README.md](../README.md) — the writing rules
