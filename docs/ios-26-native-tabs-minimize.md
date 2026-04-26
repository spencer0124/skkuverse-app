# iOS 26 NativeTabs `minimizeBehavior` 작동 조건 — chain root rule

## 한 줄 요약

iOS 26 NativeTabs (`expo-router/unstable-native-tabs` = `react-native-screens` 4.19+의 `RNSBottomTabsHostComponentView`) 의 `minimizeBehavior`가 발화하려면, 각 탭 화면의 **RNSScreen `subviews[0]` 직계가 `UIScrollView` (RN의 ScrollView/FlatList/SectionList)** 여야 한다. View wrapping 한 겹이라도 추가되면 minimize가 영구 비활성된다. 화면 root는 ScrollView/SectionList를 직계 반환하거나, `<>...</>` (Fragment)의 **첫 자식**으로 두어야 한다.

## 왜 이 룰인가 — native 메커니즘

`react-native-screens` 4.19에서 minimize 동작은 다음 native 코드 경로로 작동한다:

1. **finder 호출**: `RNSBottomTabsScreenComponentView.mm`의 `mountChildComponentView(index==0)` 시점에 단 한 번:
   ```objc
   if (index == 0) {
     [self overrideScrollViewBehaviorInFirstDescendantChainIfNeeded];
     [self updateContentScrollViewEdgeEffectsIfExists];
   }
   ```

2. **finder 알고리즘** (`RNSScrollViewFinder.mm:5-20`):
   ```objc
   while (currentView != nil) {
     if ([currentView isKindOfClass:UIScrollView.class]) return currentView;
     else if ([currentView.subviews count] > 0) currentView = currentView.subviews[0];
     else break;
   }
   ```
   명목상 strict `subviews[0]` chain을 끝까지 따라간다.

3. **실제 한계 — mount 타이밍**: `mountChildComponentView(index==0)`은 첫 자식 view가 mount되자마자 호출되며, **그 시점에 첫 자식의 자식들은 아직 mount 전**이다. 따라서 chain이 1단계 깊이에서 `subviews.count == 0`으로 break되어 nil 반환. 한 번 nil이 반환되면 `tabBarMinimizeBehavior` 자체가 영구 비활성된다 (이후 layout pass에서 finder 재호출 보장 없음).

→ 결과적으로 **1단계 깊이만 사실상 보장된다**: RNSScreen 직계가 UIScrollView여야만 minimize가 활성화된다.

## 실험적으로 확인한 사실

```
✅ <ScrollView/> 직계 반환                  → minimize 작동
❌ <View><ScrollView/></View>               → minimize 비활성 (한 겹 wrapping이 chain breaker)
✅ <><Header/><ScrollView/></>              → 첫 자식이 Header(non-ScrollView)면 안 됨
✅ <><ScrollView/><AbsOverlay/><Sheet/></>  → 첫 자식이 ScrollView면 형제는 무관
```

## 화면 작성 룰 (실전)

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
React가 root element 종류를 바꾸면 RNSScreen 입장에서 첫 자식 view가 unmount/mount된다. 이 시점에 native finder가 재호출되며 새 SectionList를 발견. 단, transient 기간(Skeleton만 보이는 동안)에 minimize는 작동 안 함.

### 분기/overlay가 있는 화면

picker/fixed 같은 분기 + selector overlay/picker sheet 같은 부수 요소가 있다면:

```tsx
return (
  <>
    <SectionList ... listHeaderHeight={SELECTOR_HEIGHT} />  {/* index 0 — finder 발견 */}
    <View style={absoluteOverlay} pointerEvents="box-none">
      <Selector ... />                                       {/* index 1 — finder 무관 */}
    </View>
    {showSheet && <BottomSheetModal ... />}                  {/* index 2+ — finder 무관 */}
  </>
);
```

selector를 absolute overlay로 두고 SectionList의 `contentContainerStyle.paddingTop`으로 만큼 패딩을 줘서 첫 row가 selector 아래에서 시작하게 한다.

### Stack header와의 호환성

`expo-router/Stack`의 `header: () => <CustomHeader />` 콜백은 native `react-native-screens` native-stack에 의해 UINavigationBar customView로 mount되므로 RNSScreen subviews 트리 밖에 위치한다. 따라서 chain에 영향 없다 — 검증됨.

`headerShown: true` 또는 `header` 콜백이 있어도 안전.

### 안티패턴

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

## skkuverse 적용 사례

### Notices 탭 (`apps/mobile/src/features/notices/`)

이 룰을 따른 fix:

- **`NoticesTabScreen.tsx`**: outer container `<View>` 제거. picker 탭은 `<>NoticeListPanel + selectorOverlay + NoticePickerSheet</>` Fragment를 반환, fixed 탭은 `<NoticeListPanel/>` 직계 반환. activeTab 미결정 transient 동안만 `<NoticeListSkeleton/>` 또는 `<NoticeEmptyState/>` 직계 반환 (Pattern B).
- **`NoticeListPanel.tsx`**: 항상 `<SectionList>`을 root로 반환. loading/error/empty는 `ListEmptyComponent` + `contentContainerStyle.flexGrow: 1` (Pattern A).
- **`(tabs)/notices/index.tsx`**: `<><Stack.Screen options={...}/><NoticesTabScreen/></>` Fragment 안 첫 자식이 NoticesTabScreen → 그 안에서 위 룰 적용.

### Transit 탭 (`apps/mobile/app/(tabs)/transit/index.tsx`)

처음부터 `<ScrollView style={container} ...>` 직계 반환. 이 룰의 모범 케이스.

## 관련 자료

- callstack/react-native-bottom-tabs Issue [#496](https://github.com/callstack/react-native-bottom-tabs/issues/496) — nested Stack과 minimize 호환성 (동일 메커니즘)
- Apple `UITabBarMinimizeBehavior` (iOS 26+) — automatic / never / onScrollDown / onScrollUp 4값
- Local native source:
  - `node_modules/react-native-screens/ios/helpers/scroll-view/RNSScrollViewFinder.mm`
  - `node_modules/react-native-screens/ios/bottom-tabs/screen/RNSBottomTabsScreenComponentView.mm:460`
  - `node_modules/react-native-screens/ios/bottom-tabs/screen/RNSTabsScreenViewController.mm:110`
- 진단 trail: `~/.claude/plans/minimize-rosy-minsky.md`, `~/.claude/plans/hidden-giggling-journal.md`
