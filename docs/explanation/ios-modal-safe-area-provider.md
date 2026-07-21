# iOS Modal Routes Need Their Own SafeAreaProvider

**TL;DR**: any expo-router route registered with `presentation: 'fullScreenModal'` (or `'modal'` / `'formSheet'`) MUST wrap its screen in its own `<SafeAreaProvider>` from `react-native-safe-area-context`. Otherwise the *first paint* of the modal can have `top: 0` insets even though subsequent state changes look correct. This is documented behavior of the rnsac + react-native-screens combo and bites every modal route, not just onboarding.

## Symptom

The very first frame of a modal route shows content directly under the status bar / dynamic island — top safe-area padding is not applied. State changes within the same modal (e.g. step 1 → step 2 of a wizard rendered by the same parent component) appear correctly. Going back to step 1 also looks correct because by then UIKit has re-laid out the view.

## Root cause

`presentation: 'fullScreenModal'` makes `react-native-screens` mount the route inside a **separate native UIViewController** with its own view hierarchy. Two consequences:

1. iOS computes `safeAreaInsets` per UIViewController. The modal VC has its own insets; they are not automatically the same as the (tabs) root VC.
2. `<SafeAreaView>` from `react-native-safe-area-context` (the **native** component) reads its own UIView's `safeAreaInsets` directly — not React props or context. During modal animation the view bounds aren't laid out yet, so the measurement returns `{top: 0, ...}` and gets baked into the first paint.

A root-level `<SafeAreaProvider>` does not help: it measures the **root** view, which is in a different view hierarchy than the modal VC. Consumers inside the modal that read context get values keyed to the wrong VC.

## The fix (canonical pattern)

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

This mounts an `RNCSafeAreaProvider` native view inside the modal VC's view hierarchy. The provider measures the modal VC's `safeAreaInsets` and broadcasts the value through React context. Any `<SafeAreaView>` or `useSafeAreaInsets()` consumer in the modal subtree receives the correct insets.

## Source references

- `react-navigation` maintainer in [react-navigation/react-navigation#11285](https://github.com/react-navigation/react-navigation/issues/11285): "you must render this [SafeAreaProvider] at the top of every screen that's backed by a native UIViewController (e.g. modals, stack navigators)".
- [Expo docs — react-native-safe-area-context](https://docs.expo.dev/versions/latest/sdk/safe-area-context/): "You may need to add it in other places too, including at the root of any modals when using react-native-screens".

## Mechanism caveat (be honest)

The exact native-level reason a modal-local provider fixes the timing race is not fully traced from the rnsac / react-native-screens source. Empirically the pattern is documented as effective for this class of bug across many GitHub issues with the same symptom shape.

If the modal-local provider does not fix a particular case, fall back to **Option B**: replace `<SafeAreaView edges={['top']}>` with `useSafeAreaInsets()` + manual `paddingTop`:

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

The hook subscribes to provider context and re-renders on broadcast updates, bypassing native SafeAreaView's timing-sensitive own-view measurement.

## Routes to audit when changing modal presentation

Any route in `app/_layout.tsx` registered with `presentation: 'modal'` / `'fullScreenModal'` / `'formSheet'`:

- `/onboarding` — **fixed (this doc)**
- `/login` — modal presentation
- `/sds-preview` — modal presentation
- `/debug-fcm` — modal presentation

Apply the same modal-local `<SafeAreaProvider>` wrap if the same symptom appears.

## What we did NOT do

- `<SafeAreaProvider initialMetrics={initialWindowMetrics}>` at root — initial-render zero-inset race only happens at the FIRST mount of the provider, which is before the user can navigate to any modal. The bug is per-modal-mount timing, not first-app-render timing. Adding `initialMetrics` would have been treating an unrelated symptom.
- Switching `presentation: 'fullScreenModal'` to default push — would change UX semantics (slide-up vs push) and isn't required when the simple wrapper fix works.

## Why root SafeAreaProvider is still kept

`app/_layout.tsx` has a root `<SafeAreaProvider>` for two reasons:

1. **Explicit > implicit**: the official react-native-safe-area-context guide and Expo docs both recommend a root provider as the standard pattern. expo-router's "implicit handling" is documented inconsistency (see [expo/expo#28818](https://github.com/expo/expo/issues/28818)).
2. **Safety net for non-modal screens** that haven't yet hit a measurement edge case but might in the future.

Modal-local providers do NOT replace the root provider — they coexist. rnsac supports nested providers; the closest ancestor wins for each consumer subtree.
