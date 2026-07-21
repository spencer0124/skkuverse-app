---
title: iOS Modal Routes Need Their Own SafeAreaProvider
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# iOS Modal Routes Need Their Own SafeAreaProvider

> `presentation: 'fullScreenModal'`(또는 `'modal'` / `'formSheet'`) 라우트는 반드시 자체 `<SafeAreaProvider>`로 감싸야 하는 이유 — 모달이 별도 UIViewController에 mount되어 root provider가 엉뚱한 VC의 insets를 계측하기 때문. 모달 라우트를 추가하거나 presentation을 바꾸는 사람이 읽는다.

## 문제

모달 라우트의 **첫 프레임**에서 콘텐츠가 status bar / dynamic island 바로 아래에 붙어 나온다 — top safe-area padding이 적용되지 않는다. 같은 모달 안에서의 state 변화(예: 같은 부모 컴포넌트가 렌더하는 wizard의 step 1 → step 2)는 정상으로 보이고, step 1로 되돌아가도 정상으로 보인다 — 그 시점엔 이미 UIKit이 view를 re-layout했기 때문. 즉 이후 state 변화는 멀쩡해 보여도 첫 paint에 `top: 0` insets가 박히는 버그다. onboarding만이 아니라 **모든 모달 라우트**에 해당한다.

## 원인 / 메커니즘

`presentation: 'fullScreenModal'`은 `react-native-screens`가 해당 라우트를 **별도 native UIViewController**의 자체 view hierarchy 안에 mount하게 만든다. 두 가지 귀결:

1. iOS는 `safeAreaInsets`를 UIViewController 단위로 계산한다. 모달 VC는 자체 insets를 가지며, (tabs) root VC의 것과 자동으로 같아지지 않는다.
2. `react-native-safe-area-context`(rnsac)의 `<SafeAreaView>` (**native** 컴포넌트)는 React props나 context가 아니라 자기 UIView의 `safeAreaInsets`를 직접 읽는다. 모달 애니메이션 중에는 view bounds가 아직 layout되지 않아 계측이 `{top: 0, ...}`을 반환하고, 그 값이 첫 paint에 박힌다.

root 레벨 `<SafeAreaProvider>`는 도움이 안 된다: **root** view를 계측하는데, 그것은 모달 VC와 다른 view hierarchy에 있다. 모달 안에서 context를 읽는 consumer는 엉뚱한 VC 기준의 값을 받는다.

> [!NOTE]
> **메커니즘 caveat (정직하게)**: 모달 로컬 provider가 타이밍 race를 고치는 정확한 native 레벨 이유는 rnsac / react-native-screens 소스에서 끝까지 추적하지 못했다. 경험적으로 이 패턴은 같은 증상 형태의 수많은 GitHub 이슈에서 유효하다고 문서화되어 있다.

## 정석 해법 / 패턴

모달 화면을 자체 `<SafeAreaProvider>`로 감싼다:

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

이렇게 하면 `RNCSafeAreaProvider` native view가 모달 VC의 view hierarchy **안에** mount된다. provider가 모달 VC의 `safeAreaInsets`를 계측해 React context로 broadcast하고, 모달 subtree의 모든 `<SafeAreaView>` / `useSafeAreaInsets()` consumer가 올바른 insets를 받는다.

### 근거 (upstream 문서)

- `react-navigation` maintainer, [react-navigation/react-navigation#11285](https://github.com/react-navigation/react-navigation/issues/11285): "you must render this [SafeAreaProvider] at the top of every screen that's backed by a native UIViewController (e.g. modals, stack navigators)".
- [Expo docs — react-native-safe-area-context](https://docs.expo.dev/versions/latest/sdk/safe-area-context/): "You may need to add it in other places too, including at the root of any modals when using react-native-screens".

### Fallback — Option B

모달 로컬 provider로 특정 케이스가 안 잡히면, `<SafeAreaView edges={['top']}>`를 `useSafeAreaInsets()` + manual `paddingTop`으로 교체한다:

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

hook은 provider context를 구독해 broadcast 업데이트 시 re-render되므로, native SafeAreaView의 타이밍에 민감한 자체-view 계측을 우회한다.

### 감사(audit) 대상 라우트

`app/_layout.tsx`에서 `presentation: 'modal'` / `'fullScreenModal'` / `'formSheet'`로 등록된 모든 라우트:

- `/onboarding` — **fixed (이 문서의 계기)**
- `/login` — modal presentation
- `/sds-preview` — modal presentation
- `/debug-fcm` — modal presentation

같은 증상이 나타나면 동일한 모달 로컬 `<SafeAreaProvider>` wrap을 적용한다.

### Root SafeAreaProvider는 그대로 유지한다

`app/_layout.tsx`의 root `<SafeAreaProvider>`는 두 가지 이유로 유지:

1. **Explicit > implicit**: react-native-safe-area-context 공식 가이드와 Expo docs 모두 root provider를 표준 패턴으로 권장한다. expo-router의 "implicit handling"은 문서화된 비일관성이 있다 ([expo/expo#28818](https://github.com/expo/expo/issues/28818)).
2. **비모달 화면의 safety net**: 아직 계측 edge case를 안 맞은 화면이 미래에 맞을 수 있다.

모달 로컬 provider는 root provider를 **대체하지 않고 공존**한다. rnsac는 nested provider를 지원하며, 각 consumer subtree에는 가장 가까운 조상이 이긴다.

## 안티패턴 — 하지 않은 것들

- **`<SafeAreaProvider initialMetrics={initialWindowMetrics}>` at root** — initial-render zero-inset race는 provider의 **첫** mount 시점에만 발생하고, 그 시점은 유저가 어떤 모달로도 이동하기 전이다. 이 버그는 per-modal-mount 타이밍이지 first-app-render 타이밍이 아니다. `initialMetrics` 추가는 무관한 증상 치료였을 것.
- **`presentation: 'fullScreenModal'` → default push 전환** — UX 시맨틱(slide-up vs push)이 바뀌며, 단순 wrapper fix가 동작하는 상황에서 불필요.

## 관련 문서

- [ios-26-native-tabs-minimize.md](ios-26-native-tabs-minimize.md) — 탭 화면의 auto contentInset (별개 메커니즘, 같은 safe-area 계열 증상)
- [docs/README.md](../README.md) — 문서 작성 규칙
