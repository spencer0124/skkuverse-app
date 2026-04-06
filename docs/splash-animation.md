# Splash Animation (SKKUverseSplash)

## Overview

앱 시작 시 OTA 업데이트 체크 + 앱 초기화 동안 표시되는 브랜드 애니메이션. "스꾸버스" 워드마크가 갈라지며 "스꾸유니버스"로 변환되는 Toss-style 모션.

웹 프로토타입(`skkuverse-splash.jsx`)을 React Native + Reanimated로 1:1 포팅.

### Files

| File | Role |
|------|------|
| `src/providers/SKKUverseSplash.tsx` | 애니메이션 컴포넌트 |
| `src/providers/InitGate.tsx` | OTA/init gating + splash 오버레이 관리 |
| `Downloads/skkuverse-splash.jsx` | 원본 웹 프로토타입 (참조용) |

---

## Animation Timeline

```
t=0       mount, 흰 화면 + "스꾸버스" centered
t=800ms   Step 1 — split: 스꾸 ←  → 버스 (0.85s TOSS_SPRING)
t=1150ms  Step 2 — reveal: 유니 container maxWidth 0→open (0.9s SMOOTH)
t=1230ms  유 등장 (opacity 0.45s ease + transform 0.85s TOSS_SPRING)
t=1310ms  니 등장 (80ms stagger)
t=1900ms  Step 3 — settle: accent line, subtitle, glow 등장
t=2600ms  Step 4 — animation settled, dismiss 대기
```

---

## Web → React Native 포팅 핵심 차이점

### 1. CSS `cubic-bezier` → `Easing.bezier`

웹의 핵심 커브 3가지를 Reanimated `Easing.bezier`로 정확히 매핑:

```
Web CSS                                    RN Reanimated
─────────────────────────────────────────────────────────
cubic-bezier(0.34, 1.56, 0.64, 1)  →  Easing.bezier(0.34, 1.56, 0.64, 1)  // TOSS_SPRING
cubic-bezier(0.16, 1, 0.3, 1)     →  Easing.bezier(0.16, 1, 0.3, 1)      // SMOOTH
cubic-bezier(0.0, 0.0, 0.2, 1)    →  Easing.bezier(0.0, 0.0, 0.2, 1)     // DECEL
```

**중요**: 처음에 `withSpring({ damping: 14, stiffness: 120, mass: 1 })`으로 근사했으나, 이는 7.4% overshoot밖에 안 됨. 웹의 TOSS_SPRING은 **56% overshoot** — `withTiming` + 정확한 bezier 커브 사용이 필수.

### 2. CSS 다중 transition → 분리된 shared values

웹 CSS는 하나의 요소에 속성별 다른 transition을 걸 수 있음:

```css
transition: opacity 0.45s ease,           /* 빠른 fade-in */
            transform 0.85s SPRING,        /* 느린 bounce */
            filter 0.5s ease;              /* blur fade */
```

Reanimated에서 하나의 shared value로 모든 속성을 구동하면 같은 커브가 적용됨 → **"쫀득한" 느낌이 사라짐**.

**해결**: 속성별 별도 shared value:

```tsx
// opacity — fast ease-in (0.45s)
c1Opacity.value = withTiming(1, { duration: 450, easing: Easing.ease });

// transform — slow TOSS_SPRING with 56% overshoot (0.85s)
c1Transform.value = withTiming(1, { duration: 850, easing: TOSS_SPRING });
```

글자가 **빠르게 나타나지만** 위치는 **통통 튀면서** 정착 — 이것이 Toss-style 핵심.

### 3. CSS `max-width` transition → Reanimated `maxWidth`

웹의 유니 reveal:
```css
max-width: isRevealing ? "4.8em" : "0em";
transition: max-width 0.9s SMOOTH;
```

처음 `width`를 애니메이션했으나, `width`는 컨테이너를 고정 크기로 강제 → "유니" 실제 폭보다 넓으면 오른쪽 빈 공간 → **가운데 정렬 어긋남**.

**해결**: `maxWidth` 사용. 콘텐츠 자연 폭으로 사이징되고, maxWidth는 클리핑만 담당:

```tsx
const revealAnim = useAnimatedStyle(() => ({
  maxWidth: interpolate(reveal.value, [0, 1], [0, revealTargetW]),
}));
```

### 4. CSS `linear-gradient` / `radial-gradient` → react-native-svg

RN에는 CSS gradient가 없음. `react-native-svg`로 정확히 재현:

**Accent line** (transparent → green → transparent):
```tsx
<SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
  <Stop offset="0" stopColor={GREEN_LIGHT} stopOpacity={0} />
  <Stop offset="0.5" stopColor={GREEN_LIGHT} stopOpacity={1} />
  <Stop offset="1" stopColor={GREEN_LIGHT} stopOpacity={0} />
</SvgLinearGradient>
```

**Radial glow** (rgba(43,90,58,0.08) → transparent):
```tsx
<SvgRadialGradient id="glow" cx="50%" cy="50%" r="50%">
  <Stop offset="0" stopColor={GREEN} stopOpacity={0.08} />
  <Stop offset="0.7" stopColor={GREEN} stopOpacity={0} />
</SvgRadialGradient>
```

### 5. CSS `filter: blur()` → expo-blur `BlurView` overlay

CSS `filter: blur(0.8px)`는 텍스트 픽셀만 부드럽게 만듦. RN에서 시도한 접근들:

| 접근 | 결과 |
|------|------|
| `filter: "blur(Xpx)"` (string) | RN이 CSS string 문법 무시 — 아예 적용 안 됨 |
| `filter: [{ blur: X }]` (array) | 적용되지만 bounding box 전체를 blur → **흰 배경 번짐 아티팩트** |
| `textShadowRadius` fallback | 그림자 추가일 뿐, blur 아님 → **녹색 얼룩** |
| **`expo-blur` BlurView overlay** | **채택** — backdrop blur로 텍스트를 frosted glass처럼 blur |

최종 구현: BlurView를 reveal 컨테이너 안에 `absoluteFillObject` overlay로 배치, opacity 1→0 애니메이션:

```tsx
<Animated.View style={[StyleSheet.absoluteFillObject, blurOverlayAnim]} pointerEvents="none">
  <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
</Animated.View>
```

### 6. CSS `em` units → 명시적 계산

CSS의 `em` 단위는 context에 따라 기준 font-size가 달라짐:

```
letterSpacing: "0.28em"  → 요소 자체 fontSize 기준
marginTop: "0.85em"      → 부모에서 상속된 fontSize 기준 (16px default)
transform: "-0.12em"     → baseStyle의 fontSize 기준
```

RN에서는 모든 em 값을 직접 계산:

```tsx
// letterSpacing — 요소 자체 fontSize 기준
letterSpacing: subtitleFontSize * 0.28

// marginTop — 상속된 16px 기준 (CSS default)
marginTop: EM_BASE * 0.85  // EM_BASE = 16

// transform — main fontSize 기준
translateX: -(fontSize * 0.12)
```

### 7. CSS `clamp()` → `Math.min(Math.max())`

```
Web: clamp(2.6rem, 10vw, 5.6rem)
RN:  Math.min(Math.max(screenW * 0.1, 42), 90)

Web: clamp(0.65rem, 2vw, 0.85rem)  // subtitle
RN:  Math.min(Math.max(screenW * 0.02, 10.4), 13.6)
```

### 8. Split — 비대칭 간격 ("스꾸 유니버스")

웹 원본은 스꾸/버스 대칭 split이었으나, 앱에서는 **"스꾸 유니버스"** 레이아웃으로 변경:
- 스꾸: 왼쪽으로 이동 (gap 생성)
- 버스: 이동 없음 (유니와 붙어서 "유니버스"로 읽힘)

```tsx
// 스꾸만 왼쪽으로 — 버스는 reveal의 layout push로만 이동 (translateX 없음)
splitL.value = withDelay(T.SPLIT, withTiming(1, { duration: 850, easing: TOSS_SPRING }));
// splitR은 애니메이션하지 않음 → 0 유지
```

버스는 reveal 컨테이너의 `maxWidth` 성장에 의해 layout으로 오른쪽으로 밀리지만, 추가 `translateX`가 없으므로 유니와 간격 없이 붙음.

---

## InitGate Integration

### Overlay 구조

이전 (blocking):
```
phase=ota/init → static splash 반환 (children 안 렌더)
phase=ready   → children 반환
```

현재 (overlay):
```
항상 children 렌더 + SKKUverseSplash가 absoluteFillObject로 위에 덮음
isReady=true + animation settled → splash fade-out → onDismiss
```

**이유**: phase가 resume에서 리셋될 때 children이 안 보이는 빈 프레임 방지.

### isReady / onDismiss 동작

```tsx
<SKKUverseSplash
  isReady={phase === 'ready'}          // OTA + init 완료 시 true
  onDismiss={() => setShowSplash(false)} // fade-out 끝나면 splash 제거
/>
```

- `isReady=true` 시점에 애니메이션이 아직 안 끝났으면 → **끝날 때까지 대기** 후 dismiss
- 애니메이션이 이미 끝났는데 `isReady=false`면 → **waiting dots** (breathing pulse) 표시
- 이 두 조건이 조합되어 OTA가 빠르든 느리든 자연스러운 전환

### Waiting dots

`settled && !isReady` 조건에서 3-dot breathing 애니메이션:

```tsx
withRepeat(
  withSequence(
    withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
    withTiming(0.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
  ),
  -1, false,
)
```

각 dot에 150ms stagger delay → 물결치는 로딩 효과.

---

## Tuning Guide

| 파라미터 | 현재 값 | 조정 방법 |
|----------|---------|----------|
| `revealTargetW` | `fontSize * 2.1` | Pretendard 폰트 로드 후 실기기에서 확인, 잘리면 올리기 |
| BlurView `intensity` | `20` | 높이면 blur 강함, 낮추면 약함 (0-100) |
| Blur overlay duration | `1000ms` | 길면 blur 오래 유지, 짧으면 빨리 선명해짐 |
| `TOSS_SPRING` bezier | `(0.34, 1.56, 0.64, 1)` | y1=1.56이 overshoot 크기 결정 |
| Split distance | `fontSize * 0.12` | 웹 동일 (0.12em) |
| Char slide distance | `fontSize * 0.6` | 웹 동일 (0.6em) |

---

## Native Build Requirement

`expo-blur`는 네이티브 모듈 → Expo Go에서는 동작하지 않음. 반드시 `expo run:ios` / `expo run:android`로 네이티브 빌드 필요.

```bash
npx expo install expo-blur   # 설치 (이미 완료)
npx expo prebuild --clean    # 네이티브 코드 재생성
npx expo run:ios             # 빌드 + 실행
```
