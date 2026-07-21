---
title: iOS 26 NativeTabs Chain Root Rule
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# iOS 26 NativeTabs Chain Root Rule

> iOS 26 NativeTabs의 minimize-on-scroll과 headerless 화면 auto contentInset이 왜 "RNSScreen 직계 자식이 ScrollView여야만" 작동하는지(native finder 메커니즘)와, 이를 만족시키는 화면 작성 패턴. 탭 화면을 새로 만들거나 loading 분기를 추가하는 사람이 읽는다.

## 문제

iOS 26 NativeTabs (`expo-router/unstable-native-tabs` = `react-native-screens` 4.19+의 `RNSBottomTabsHostComponentView`)의 두 동작이 특정 화면에서 조용히 영구 비활성된다:

| 동작 | 어떻게 작동하나 | 깨졌을 때 증상 |
| --- | --- | --- |
| **minimize-on-scroll** (iOS 26) | UITabBarController가 mount 시점에 first-descendant ScrollView를 tracking scroll view로 자동 등록 → 스크롤 방향 감지 시 탭 바 minimize/expand | 탭 바가 절대 minimize 안 됨 |
| **Auto contentInset adjustment** | `RNSScrollViewHelper.overrideScrollViewBehaviorInFirstDescendantChainFrom:`가 chain root ScrollView의 `contentInsetAdjustmentBehavior`를 `Never`(RN 기본) → `Automatic`으로 flip → safe-area inset(특히 `headerShown:false`일 때 status bar 영역)이 contentInset.top에 자동 반영 | 컨텐츠가 status bar 아래로 들어가 시계와 겹침 |

두 동작 **모두** 같은 native finder에 게이트된다. 조건: 각 탭 화면의 **RNSScreen `subviews[0]` 직계가 `UIScrollView`** (RN의 ScrollView/FlatList/SectionList)여야 한다. View wrapping 한 겹만 추가되거나, isLoading 분기가 첫 마운트에 ScrollView가 아닌 view를 두면 두 동작 모두 영구 비활성된다.

두 동작 모두 RN의 `ScrollView` 기본 `contentInsetAdjustmentBehavior=Never` (UIKit 기본 `Automatic` 대신) 정책 위에서 작동하므로, RNS가 의도적으로 chain root에 한해 UIKit-native 동작으로 reverts하는 구조다.

## 원인 / 메커니즘

`react-native-screens` 4.19에서 두 동작 모두 다음 native 코드 경로로 작동한다:

1. **finder 호출**: `RNSBottomTabsScreenComponentView.mm:463`의 `mountChildComponentView(index==0)` 시점에 단 한 번:

   ```objc
   if (index == 0) {
     [self overrideScrollViewBehaviorInFirstDescendantChainIfNeeded];
     [self updateContentScrollViewEdgeEffectsIfExists];
   }
   ```

   첫 메서드는 `RNSScrollViewHelper.mm:6`에서 finder를 호출해 chain root ScrollView를 찾고, 그것의 `contentInsetAdjustmentBehavior`만 `Automatic`으로 flip (단일 책임). 두 번째는 scroll-edge appearance 처리. UITabBarController의 minimize tracking 또한 같은 first-descendant chain 위에서 작동한다.

2. **finder 알고리즘** (`RNSScrollViewFinder.mm:5-20`):

   ```objc
   while (currentView != nil) {
     if ([currentView isKindOfClass:UIScrollView.class]) return currentView;
     else if ([currentView.subviews count] > 0) currentView = currentView.subviews[0];
     else break;
   }
   ```

   명목상 strict `subviews[0]` chain을 끝까지 따라간다.

3. **실제 한계 — mount 타이밍**: `mountChildComponentView(index==0)`은 첫 자식 view가 mount되자마자 호출되며, **그 시점에 첫 자식의 자식들은 아직 mount 전**이다. 따라서 chain이 1단계 깊이에서 `subviews.count == 0`으로 break되어 nil 반환. 한 번 nil이 반환되면 두 동작 모두 영구 비활성된다 — finder 재호출이 layout pass에서 보장되지 않고, RN의 root element 종류 변경(예: `<View>` → `<ScrollView>` swap) 시점이 와야만 RN이 RNSScreen 첫 자식을 unmount/mount해 finder가 재발화한다.

→ 결과적으로 **1단계 깊이만 사실상 보장된다**: RNSScreen 직계가 UIScrollView여야만 minimize와 auto contentInset 둘 다 활성화된다.

### 실험적으로 확인한 사실

```text
✅ <ScrollView/> 직계 반환                  → minimize 작동
❌ <View><ScrollView/></View>               → minimize 비활성 (한 겹 wrapping이 chain breaker)
❌ <><Header/><ScrollView/></>              → 첫 자식이 Header(non-ScrollView)면 안 됨
✅ <><ScrollView/><AbsOverlay/><Sheet/></>  → 첫 자식이 ScrollView면 형제는 무관
```

## 정석 해법 / 패턴

### 단순 화면

```tsx
// ✅ OK
export default function MyScreen() {
  return <ScrollView>...</ScrollView>;
}
```

### Loading/Error/Empty 상태가 있는 화면

`if (isLoading) return <Skeleton/>` 같은 분기는 `<Skeleton/>` 자체가 ScrollView가 아니면 chain이 깨진다. 두 가지 패턴 중 선택:

**Pattern A — SectionList의 `ListEmptyComponent` 사용 (권장)**:

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

SectionList가 항상 root → finder 항상 발견.

**Pattern B — 짧은 transient만 허용 (덜 권장)**:

```tsx
if (!ready) return <Skeleton/>;          // brief moment, finder가 nil 반환
return <SectionList .../>;               // ready 시점에 root 교체로 RN unmount/mount
                                         // → mountChildComponentView 재발화 → finder 재호출
```

React가 root element 종류를 바꾸면 RNSScreen 입장에서 첫 자식 view가 unmount/mount된다. 이 시점에 native finder가 재호출되며 새 SectionList를 발견한다. 단, transient 기간(Skeleton만 보이는 동안)에 minimize는 작동하지 않는다.

### 분기/overlay가 있는 화면

picker/fixed 같은 분기 + selector overlay/picker sheet 같은 부수 요소가 있다면, **selector를 SectionList의 `ListHeaderComponent`로 흡수**하는 게 가장 안전하다:

```tsx
return (
  <>
    <SectionList                                             {/* index 0 — finder 발견 */}
      ...
      ListHeaderComponent={<Selector ... />}                 {/* list 첫 row로 mount, visible 보장 */}
    />
    {showSheet && <BottomSheetModal ... />}                  {/* index 1+ — finder 무관 (portal) */}
  </>
);
```

selector가 list와 함께 스크롤되는 trade-off가 있지만 mount/visible이 항상 보장된다.

### Stack header와의 호환성

`expo-router/Stack`의 `header: () => <CustomHeader />` 콜백은 native `react-native-screens` native-stack에 의해 UINavigationBar customView로 mount되므로 RNSScreen subviews 트리 밖에 위치한다. 따라서 chain에 영향 없다 — 검증됨.

`headerShown: true` 또는 `header` 콜백이 있어도 안전하다.

## 안티패턴

```tsx
// ❌ outer wrapping View — chain breaker
return (
  <View style={{ flex: 1 }}>
    <ScrollView>...</ScrollView>
  </View>
);

// ❌ if문 분기 → 첫 분기가 non-ScrollView
if (loading) return <View><Spinner/></View>;
return <SectionList ... />;
// 이 패턴은 화면이 loading 상태로 첫 mount되면 finder가 영구 nil 반환.
// SectionList로 swap 시 RN이 root unmount/mount하므로 finder 재발화는 되지만,
// loading이 길거나 다시 loading 상태로 돌아가면 minimize 끊긴다.
```

**absolute overlay 패턴도 권장하지 않음** — chain rule은 충족되지만 RNSScreen 좌표계와 navigation bar 영역 overlap, view ordering, safe-area inset 처리 등으로 시각적으로 silent invisible될 수 있다. 굳이 sticky 효과가 필요하면 SectionList의 stickyHeader 패턴을 써라:

```tsx
// ⚠️ absolute overlay — 시각적으로 안 보일 수 있음 (NoticesTabScreen에서 실제 발생 사례)
<>
  <SectionList ... listHeaderHeight={SELECTOR_HEIGHT} />
  <View style={absoluteOverlay} pointerEvents="box-none">
    <Selector />
  </View>
</>
```

### 실패 사례: selector absolute overlay (2026-04-26)

Notices 탭 첫 fix 시도에서 picker selector를 absolute positioned overlay (`<View style={{position:'absolute', top:0, ...}}><Selector/></View>`)로 Fragment 두 번째 자식에 두는 패턴을 적용했다. chain rule은 충족됐지만 selector 자체가 시각적으로 안 보이는 증상이 발생 — 정확한 원인은 RNSScreen 좌표계 / nav bar overlap / iOS layout pass 순서 등 native 디테일이지만, 실용적 결론은 "absolute overlay는 silent invisible 위험이 있다". 결국 SectionList의 `ListHeaderComponent`로 selector를 흡수하는 패턴으로 변경 — visible 보장 + chain rule 동시 충족.

### 실패 사례: Transit 탭 isLoading sibling 분기 (2026-05-08)

`apps/mobile/app/(tabs)/transit/index.tsx`는 `headerShown:false` + ScrollView 직계 반환 화면. 처음 fix에서 `isLoading ? <View><Skeleton/></View> : <ScrollView>...</ScrollView>` 패턴이었는데, cold-start 진입 시 `<View>`가 첫 마운트되어 finder가 nil 반환 → ScrollView로 swap된 후에도 auto contentInset이 영원히 발화 안 함 → 첫 row가 status bar(시계 영역)와 겹치는 증상 발견. 정정 후 패턴 — **isLoading 분기를 ScrollView 안으로 흡수**:

```tsx
return (
  <ScrollView style={container} contentContainerStyle={[...]}>     {/* chain root이 항상 ScrollView */}
    {isLoading ? <TransitSkeleton/> : <>{...rows}</>}                {/* swap은 ScrollView 안에서만 */}
  </ScrollView>
);
```

이로써 cold-start와 hot-reload 양쪽 모두에서 NativeTabs 자동 inset이 일관되게 status-bar 높이를 contentInset.top에 반영한다. iOS<26 + Android JS Tabs 환경은 자동 inset이 없으므로 `paddingTop: useSafeAreaInsets().top`을 manual로 적용 (`NEEDS_MANUAL_TOP_INSET` 분기).

## skkuverse 적용 사례 — Notices 탭

`apps/mobile/src/features/notices/`에서 이 룰을 따른 fix:

- **`NoticesTabScreen.tsx`**: outer container `<View>` 제거. picker 탭은 `<>NoticeListPanel + NoticePickerSheet</>` Fragment를 반환하고, picker selector는 NoticeListPanel의 `listHeader` prop으로 SectionList 안에 흡수. fixed 탭은 `<NoticeListPanel/>` 직계 반환. activeTab 미결정 transient 동안만 `<NoticeListSkeleton/>` 또는 `<NoticeEmptyState/>` 직계 반환 (Pattern B).
- **`NoticeListPanel.tsx`**: 항상 `<SectionList>`을 root로 반환. loading/error/empty는 `ListEmptyComponent` + `contentContainerStyle.flexGrow: 1` (Pattern A). `listHeader` prop으로 외부에서 ListHeaderComponent 주입 가능.
- **`(tabs)/notices/index.tsx`**: `<><Stack.Screen options={...}/><NoticesTabScreen/></>` Fragment 안 첫 자식이 NoticesTabScreen → 그 안에서 위 룰 적용.

## 관련 문서

- [ios-modal-safe-area-provider.md](ios-modal-safe-area-provider.md) — 모달 라우트의 safe-area 계측 이슈 (별개 메커니즘)
- callstack/react-native-bottom-tabs Issue [#496](https://github.com/callstack/react-native-bottom-tabs/issues/496) — nested Stack과 minimize 호환성 (동일 메커니즘)
- Apple `UITabBarMinimizeBehavior` (iOS 26+) — automatic / never / onScrollDown / onScrollUp 4값
- Local native source:
  - `node_modules/react-native-screens/ios/helpers/scroll-view/RNSScrollViewFinder.mm`
  - `node_modules/react-native-screens/ios/bottom-tabs/screen/RNSBottomTabsScreenComponentView.mm:460`
  - `node_modules/react-native-screens/ios/bottom-tabs/screen/RNSTabsScreenViewController.mm:110`
- 진단 trail: `~/.claude/plans/minimize-rosy-minsky.md`, `~/.claude/plans/hidden-giggling-journal.md`
