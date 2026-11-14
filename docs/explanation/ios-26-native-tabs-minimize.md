---
title: iOS 26 NativeTabs Chain Root Rule
type: explanation
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# iOS 26 NativeTabs Chain Root Rule

> Why `minimize-on-scroll` and the automatic contentInset on headerless screens both need the RNSScreen's direct child to be a ScrollView, and how to write a tab screen that satisfies the native finder. Read this before building a new tab screen or adding a loading branch to one.

> [!NOTE]
> **This rule applies to the native-tabs shell only, and retires with it.** Since 2026-10-25 every
> build runs the shared-map shell, and the native tabs run only under a local override
> ([shared-map.md](shared-map.md#two-shells-one-override)). The shared-map shell has no NativeTabs, so
> the bar never shrinks on scroll and nothing switches a tab root to the automatic inset. There, a tab
> root that wants the automatic inset sets `contentInsetAdjustmentBehavior` itself and clears the
> custom bar through `useTabBarInset`, as `HomeScreen` and `homeBottomRoom` in `apps/mobile/src/features/home/` do.
> Until the native-tabs shell is deleted, a tab screen still has to satisfy the rule below. Home
> and notices are the same screens in both shells, and the native shell's campus and transit tabs
> are today's screens.

## The problem

iOS 26 NativeTabs (`expo-router/unstable-native-tabs`, built on the tabs host in
`react-native-screens`) has two
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

Both behaviours run through this native path in the installed `react-native-screens`.

1. **The finder is called** from the tab screen component
   (`ios/tabs/screen/RNSTabsScreenComponentView.mm`), inside
   `mountChildComponentView` for the child at index 0:

   ```objc
   if (index == 0) {
     if (_isOverrideScrollViewContentInsetAdjustmentBehaviorSet) {
       [self overrideScrollViewBehaviorInFirstDescendantChainIfNeeded];
     } else {
       _needsScrollViewBehaviorOverride = YES;
     }
   }
   ```

   The override is gated by the `overrideScrollViewContentInsetAdjustmentBehavior` prop.
   expo-router passes it as `!disableAutomaticContentInsets`, so it is on unless a tab opts
   out. On the first render, before props arrive, the call is deferred until they do.
   `RNSScrollViewHelper` then runs the finder to locate the chain root ScrollView and flips
   only its `contentInsetAdjustmentBehavior` to `Automatic`, which is its single
   responsibility. UITabBarController's `minimize-on-scroll` tracking runs off the same
   first-descendant chain.

2. **The finder's algorithm**, in `RNSScrollViewFinder.mm`:

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

A deeper chain can resolve when the first render is deferred, because the children may
have mounted by the time props arrive. Nothing guarantees it. So in practice **only one
level of depth is guaranteed**. The RNSScreen's direct child has to
be a UIScrollView for either `minimize-on-scroll` or the automatic contentInset to work.

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
which calls the native finder again and lets it discover the new SectionList. `minimize-on-scroll` does
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
outside the RNSScreen subviews tree, so it has no effect on the chain, which has been
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
safe-area insets can combine to make the overlay silently invisible. When a screen
needs a sticky effect, use SectionList's sticky header instead:

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

The first attempt at fixing the notices tab put the picker selector in an overlay with
`position: 'absolute'`, `<View style={{position:'absolute', top:0, ...}}><Selector/></View>`, as
the second child of a Fragment. The chain rule was satisfied and the selector was invisible
anyway. The exact cause is not known. It lies in the RNSScreen coordinate space, the nav bar
overlap, or the order of the iOS layout pass. The practical conclusion is that an
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
- **`NoticesTab.tsx`**, which the `(tabs)/notices/index.tsx` route renders, returns
  `<><Stack.Screen options={...}/><NoticesTabScreen/></>`, whose first child is
  NoticesTabScreen, where the rules above apply.

## Related

- callstack/react-native-bottom-tabs issue
  [#496](https://github.com/callstack/react-native-bottom-tabs/issues/496) — nested Stack and
  `minimize-on-scroll` compatibility, the same mechanism
- Apple's `UITabBarMinimizeBehavior` (iOS 26 and later), with its four values: automatic,
  never, onScrollDown, onScrollUp
- The native source, locally:
  - `node_modules/react-native-screens/ios/helpers/scroll-view/RNSScrollViewFinder.mm`
  - `node_modules/react-native-screens/ios/helpers/scroll-view/RNSScrollViewHelper.mm`
  - `node_modules/react-native-screens/ios/tabs/screen/RNSTabsScreenComponentView.mm`
  - `node_modules/react-native-screens/ios/tabs/screen/RNSTabsScreenViewController.mm`
