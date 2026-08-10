---
title: iOS 26 NativeTabs Chain Root Rule
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# iOS 26 NativeTabs Chain Root Rule

> Why `minimize-on-scroll` and the automatic contentInset on headerless screens both need the RNSScreen's direct child to be a ScrollView, and how to write a tab screen that satisfies the native finder. Read this before building a new tab screen or adding a loading branch to one.

## The problem

iOS 26 NativeTabs (`expo-router/unstable-native-tabs`, which is
`RNSBottomTabsHostComponentView` in `react-native-screens` 4.19 and later) has two
behaviours that go silently and permanently dead on some screens.

| Behaviour | How it works | Symptom when broken |
| --- | --- | --- |
| **`minimize-on-scroll`** (iOS 26) | At mount, UITabBarController registers the first-descendant ScrollView as its tracking scroll view, then shrinks or expands the tab bar as that view scrolls | The tab bar never shrinks |
| **Automatic contentInset adjustment** | `RNSScrollViewHelper.overrideScrollViewBehaviorInFirstDescendantChainFrom:` flips the chain root ScrollView's `contentInsetAdjustmentBehavior` from `Never`, React Native's default, to `Automatic`, so the safe-area inset reaches `contentInset.top`. That matters most with `headerShown:false`, where the status bar area is included | Content slides under the status bar and collides with the clock |

**Both** are gated by the same native finder. The condition is that each tab screen's
**RNSScreen `subviews[0]` is directly a `UIScrollView`**, meaning React Native's ScrollView,
FlatList or SectionList. One layer of View wrapping, or an isLoading branch that mounts
something other than a ScrollView first, kills both permanently.

Both also build on React Native's choice to default `contentInsetAdjustmentBehavior` to
`Never` rather than UIKit's `Automatic`. RNS reverts to the UIKit-native behaviour for the
chain root alone, and deliberately only there.

## The mechanism

In `react-native-screens` 4.19, both behaviours run through this native path.

1. **The finder is called** exactly once, at
   `RNSBottomTabsScreenComponentView.mm:463`, inside `mountChildComponentView(index==0)`:

   ```objc
   if (index == 0) {
     [self overrideScrollViewBehaviorInFirstDescendantChainIfNeeded];
     [self updateContentScrollViewEdgeEffectsIfExists];
   }
   ```

   The first method calls the finder from `RNSScrollViewHelper.mm:6` to locate the chain root
   ScrollView, and flips only its `contentInsetAdjustmentBehavior` to `Automatic`, which is
   its single responsibility. The second handles scroll-edge appearance.
   UITabBarController's minimize tracking runs off the same first-descendant chain.

2. **The finder's algorithm**, in `RNSScrollViewFinder.mm:5-20`:

   ```objc
   while (currentView != nil) {
     if ([currentView isKindOfClass:UIScrollView.class]) return currentView;
     else if ([currentView.subviews count] > 0) currentView = currentView.subviews[0];
     else break;
   }
   ```

   Nominally it follows a strict `subviews[0]` chain the whole way down.

3. **The real limit is mount timing.** `mountChildComponentView(index==0)` runs as soon as
   the first child view mounts, and **at that moment the first child's own children have not
   mounted yet**. So the chain breaks one level deep, where `subviews.count == 0`, and the
   finder returns nil. Once that happens both behaviours are dead: nothing guarantees the
   finder runs again during a layout pass. It re-fires only when React changes the kind of
   root element, such as swapping a `<View>` for a `<ScrollView>`, which makes React Native
   unmount and remount the RNSScreen's first child.

So in practice **only one level of depth is guaranteed**. The RNSScreen's direct child has to
be a UIScrollView for either minimize or the automatic contentInset to work.

### Verified by experiment

```text
✅ returns <ScrollView/> directly           → minimize works
❌ <View><ScrollView/></View>               → dead. One wrapping layer breaks the chain
❌ <><Header/><ScrollView/></>              → dead, since the first child is a non-ScrollView
✅ <><ScrollView/><AbsOverlay/><Sheet/></>  → fine. With a ScrollView first, siblings are irrelevant
```

## The patterns that work

### A simple screen

```tsx
// ✅ OK
export default function MyScreen() {
  return <ScrollView>...</ScrollView>;
}
```

### A screen with loading, error or empty states

A branch such as `if (isLoading) return <Skeleton/>` breaks the chain whenever `<Skeleton/>`
is not itself a ScrollView. Pick one of two patterns.

**Pattern A, SectionList's `ListEmptyComponent`, recommended:**

```tsx
return (
  <SectionList
    sections={sections}                   // empty during loading/error
    ListEmptyComponent={
      isLoading ? <Skeleton/> :
      isError ? <ErrorView .../> : <EmptyView/>
    }
    contentContainerStyle={[
      base,
      sections.length === 0 ? { flexGrow: 1 } : null,
    ]}
    ...
  />
);
```

The SectionList is always the root, so the finder always finds it.

**Pattern B, a brief transient only, less preferred:**

```tsx
if (!ready) return <Skeleton/>;          // briefly, and the finder returns nil
return <SectionList .../>;               // swapping the root makes RN unmount and remount
                                         // → mountChildComponentView fires → finder runs again
```

Changing the kind of root element makes the RNSScreen's first child unmount and remount,
which calls the native finder again and lets it discover the new SectionList. Minimize does
not work during the transient, while only the Skeleton is on screen.

### A screen with branches or an overlay

With a picker-or-fixed branch plus extras such as a selector overlay or a picker sheet, the
safest arrangement is to **absorb the selector into the SectionList's
`ListHeaderComponent`**:

```tsx
return (
  <>
    <SectionList                                             {/* index 0 — the finder sees this */}
      ...
      ListHeaderComponent={<Selector ... />}                 {/* mounts as the list's first row, guaranteed visible */}
    />
    {showSheet && <BottomSheetModal ... />}                  {/* index 1+ — irrelevant to the finder, it is a portal */}
  </>
);
```

The trade-off is that the selector scrolls with the list, but both mounting and visibility
are guaranteed.

### Compatibility with a Stack header

The `header: () => <CustomHeader />` callback from `expo-router/Stack` is mounted by the
native `react-native-screens` native stack as a UINavigationBar customView, which puts it
outside the RNSScreen subviews tree. It therefore has no effect on the chain, which has been
verified. Both `headerShown: true` and a `header` callback are safe.

## Anti-patterns

```tsx
// ❌ an outer wrapping View breaks the chain
return (
  <View style={{ flex: 1 }}>
    <ScrollView>...</ScrollView>
  </View>
);

// ❌ a branch whose first arm is not a ScrollView
if (loading) return <View><Spinner/></View>;
return <SectionList ... />;
// If the screen first mounts in its loading state, the finder returns nil for good.
// Swapping to the SectionList does make RN unmount and remount the root, so the finder
// re-fires, but a long load or a return to the loading state breaks minimize again.
```

**The absolute overlay pattern is also discouraged.** It satisfies the chain rule, but the
RNSScreen coordinate space, overlap with the navigation bar area, view ordering and
safe-area insets can combine to make the overlay silently invisible. When a sticky effect is
genuinely needed, use SectionList's sticky header instead:

```tsx
// ⚠️ absolute overlay — can end up invisible, as it did in NoticesTabScreen
<>
  <SectionList ... listHeaderHeight={SELECTOR_HEIGHT} />
  <View style={absoluteOverlay} pointerEvents="box-none">
    <Selector />
  </View>
</>
```

### Failure case: the selector absolute overlay (2026-04-26)

The first attempt at fixing the notices tab put the picker selector in an absolutely
positioned overlay, `<View style={{position:'absolute', top:0, ...}}><Selector/></View>`, as
the second child of a Fragment. The chain rule was satisfied and the selector was invisible
anyway. The exact cause sits somewhere in the RNSScreen coordinate space, the nav bar
overlap, or the order of the iOS layout pass, but the practical conclusion is that an
absolute overlay risks being silently invisible. The fix was to absorb the selector into the
SectionList's `ListHeaderComponent`, which guarantees visibility and satisfies the chain rule
at once.

### Failure case: the transit tab's isLoading sibling branch (2026-05-08)

`apps/mobile/app/(tabs)/transit/index.tsx` is a `headerShown:false` screen returning a
ScrollView directly. The first fix used
`isLoading ? <View><Skeleton/></View> : <ScrollView>...</ScrollView>`. On a cold start the
`<View>` mounted first, so the finder returned nil, and the automatic contentInset never
fired even after the swap to the ScrollView. The first row overlapped the status bar and the
clock. The corrected pattern **absorbs the isLoading branch inside the ScrollView**:

```tsx
return (
  <ScrollView style={container} contentContainerStyle={[...]}>     {/* the chain root is always a ScrollView */}
    {isLoading ? <TransitSkeleton/> : <>{...rows}</>}                {/* the swap happens inside it */}
  </ScrollView>
);
```

With that, the NativeTabs automatic inset reflects the status bar height in
`contentInset.top` consistently, on a cold start and on a hot reload alike. iOS before 26 and
Android's JS tabs have no automatic inset, so those apply `paddingTop:
useSafeAreaInsets().top` by hand, through the `NEEDS_MANUAL_TOP_INSET` branch.

## How the notices tab applies it

The fix in `apps/mobile/src/features/notices/`:

- **`NoticesTabScreen.tsx`** drops its outer container `<View>`. A picker tab returns the
  Fragment `<>NoticeListPanel + NoticePickerSheet</>`, with the picker selector absorbed into
  the SectionList through NoticeListPanel's `listHeader` prop. A fixed tab returns
  `<NoticeListPanel/>` directly. Only while activeTab is undecided does it return
  `<NoticeListSkeleton/>` or `<NoticeEmptyState/>` directly, which is pattern B.
- **`NoticeListPanel.tsx`** always returns a `<SectionList>` as its root. Loading, error and
  empty go through `ListEmptyComponent` with `contentContainerStyle.flexGrow: 1`, which is
  pattern A. Its `listHeader` prop lets a caller inject a ListHeaderComponent.
- **`(tabs)/notices/index.tsx`** returns
  `<><Stack.Screen options={...}/><NoticesTabScreen/></>`, whose first child is
  NoticesTabScreen, where the rules above apply.

## Related

- [ios-modal-safe-area-provider.md](ios-modal-safe-area-provider.md) — safe-area measurement
  on modal routes, a separate mechanism
- callstack/react-native-bottom-tabs issue
  [#496](https://github.com/callstack/react-native-bottom-tabs/issues/496) — nested Stack and
  minimize compatibility, the same mechanism
- Apple's `UITabBarMinimizeBehavior` (iOS 26 and later), with its four values: automatic,
  never, onScrollDown, onScrollUp
- The native source, locally:
  - `node_modules/react-native-screens/ios/helpers/scroll-view/RNSScrollViewFinder.mm`
  - `node_modules/react-native-screens/ios/bottom-tabs/screen/RNSBottomTabsScreenComponentView.mm:460`
  - `node_modules/react-native-screens/ios/bottom-tabs/screen/RNSTabsScreenViewController.mm:110`
