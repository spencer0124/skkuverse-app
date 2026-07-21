---
title: Android Naver Map Custom View Marker Race
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# Android Naver Map Custom View Marker Race

> Naver Map 커스텀 뷰 마커가 Android에서만 간헐적으로 안 보이는 이유(bitmap snapshot race)와, `renderToHardwareTextureAndroid` + `key` 시각적 의존성으로 해결한 패턴. 지도 마커를 수정하는 사람이 읽는다.

## 문제

`@mj-studio/react-native-naver-map`의 `NaverMapMarkerOverlay`에 React Native View를 children으로 넘기면, iOS에서는 모든 마커가 정상 표시되지만 **Android에서는 일부 마커만 간헐적으로 표시**된다.

## 원인 / 메커니즘

Android 네이티브 코드(`RNCNaverMapMarker.kt`)의 비트맵 스냅샷 race condition:

1. `setCustomView()` 호출 시 즉시 `updateCustomView()` 실행
2. `updateCustomView()`가 `draw(canvas)`로 View를 비트맵으로 캡처
3. **이 시점에 View의 layout이 아직 완료되지 않았으면 1x1px 투명 비트맵이 생성됨** → 마커 안 보임
4. `ViewChangesTracker`가 40ms 간격으로 폴링하며 재캡처를 시도하지만, 타이밍에 따라 일부 마커가 누락

iOS에서는 `renderInContext`로 동기 스냅샷을 뜨기 때문에 이 문제가 발생하지 않는다.

참고: [GitHub Issue #120](https://github.com/mym0404/react-native-naver-map/issues/120), [#143](https://github.com/mym0404/react-native-naver-map/issues/143)

## 정석 해법 / 패턴

두 가지 속성을 추가하여 Android에서도 custom view 마커가 안정적으로 렌더링되도록 한다. 적용 파일: `apps/mobile/src/features/map/components/MapMarkerLayer.tsx`.

### 1. `renderToHardwareTextureAndroid` on child View

```tsx
<View
  collapsable={false}
  renderToHardwareTextureAndroid  // <-- 추가
  style={styles.dotMarker}
>
  <Text>{displayNo}</Text>
</View>
```

View를 offscreen 하드웨어 텍스처로 먼저 렌더링하여, `draw(canvas)` 시점에 완성된 비트맵을 캡처할 수 있도록 한다.

### 2. `key`에 시각적 의존성 포함

```tsx
<NaverMapMarkerOverlay
  key={`${key}-${marker.displayNo}`}  // <-- displayNo 포함
  ...
>
  <NumberDotMarker displayNo={marker.displayNo ?? ''} />
</NaverMapMarkerOverlay>
```

라이브러리 공식 문서에서 권장하는 방식. 최상위 자식의 key에 시각적 의존성을 넣으면 React가 View를 새로 마운트하여 비트맵 재캡처를 트리거한다.

### 전제 조건 (기존에 이미 적용되어 있던 것)

- `collapsable={false}` — Android에서 View 노드가 최적화로 제거되는 것을 방지
- `width`, `height` 명시적 지정 — `NaverMapMarkerOverlay`와 child View 모두

## 안티패턴 / 대안 비교

- `react-native-svg`, `react-native-skia` 등으로 마커를 그리는 방법도 있지만, SVG 컴포넌트도 결국 React Native View이므로 같은 race condition이 발생할 수 있다.
- 정적 PNG 에셋을 `require()`로 로드하면 Fresco를 통해 동기 로드되어 race condition이 없지만, 확장성이 떨어진다.
- 현재 해법(`renderToHardwareTextureAndroid` + `key`)이 가장 코드 변경이 적고 플랫폼 분기 없이 동작한다.

## 관련 문서

- [docs/README.md](../README.md) — 문서 작성 규칙
- 라이브러리 patch: `patches/@mj-studio+react-native-naver-map+2.7.0.patch` (nil iconImage crash fix — 별개 이슈)
