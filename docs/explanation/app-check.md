---
title: App Check
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# App Check

> 한 줄 요약: Firebase App Check의 provider 구성, iOS Simulator 디버그 토큰 주입 경로(왜 env 경로만 동작하는지), Play Integrity 스로틀(-8)과 `primeAppCheck` 절충을 설명한다. App Check 관련 코드나 Firestore write 실패를 다루기 전에 읽는다.

## 구성 요약

Provider 설정은 `apps/mobile/src/services/app-check.ts`에 있다:

| 플랫폼 | `__DEV__` | 프로덕션 |
| --- | --- | --- |
| iOS | `debug` provider (+ debug token) | `appAttestWithDeviceCheckFallback` (App Attest) |
| Android | `debug` provider (+ debug token) | `playIntegrity` (Play Integrity) |

## 디버그 토큰 주입 경로 (iOS Simulator)

`__DEV__` 빌드에서 어떤 debug token이 쓰일지 제어하는 유일하게 신뢰 가능한 경로:

```text
.env (FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS / _ANDROID)
  → app.config.ts extra
  → src/services/app-check.ts provider.configure({ apple: { debugToken } })
```

- **메커니즘:** RN Firebase가 내부적으로 `setenv("FIRAAppCheckDebugToken", value)`를 호출하고, AppCheckCore가 이 **env 경로**로 토큰을 읽는다.
- **UserDefaults fallback은 믿지 말 것:** `GACAppCheckDebugToken`을 UserDefaults로 넣는 fallback은 **iOS Simulator + 이 Expo prebuild 조합에서 silently 무시된다** — 2026-04-22 재현·확정. 에러도 없이 그냥 다른(자동 생성) 토큰이 쓰인다.
- **프로덕션 안전:** `EAS_BUILD_PROFILE=beta|production`이면 `app.config.ts` extras에서 debug token이 **자동 strip**된다 → 퍼블릭 레포·프로덕션 번들에 토큰이 새지 않는다.

### 트러블슈팅 — Simulator에서 토큰 교환 실패 시

시뮬레이터에서 App Check 토큰 교환이 안 되면 **가장 먼저** Firebase Console 등록을 확인한다:

1. Firebase Console → App Check → iOS 앱 → **Manage debug tokens**
2. `.env`의 값과 **정확히 같은 UUID**가 등록돼 있는지 확인 (오타·공백 포함 불일치가 흔한 원인)

## Play Integrity 스로틀 (-8)과 `primeAppCheck`

### 사고

과거 구현은 Firestore write마다 App Check 토큰을 **강제 갱신**(`getToken(true)`)했다. 강제 갱신은 매번 Play Integrity attestation API를 호출하는데 이 API에는 쿼터가 있어서, write 밀집 구간(온보딩: 로그인 → 기기등록 → 시드 → 토글)에서 스로틀(-8)에 걸렸다. 스로틀 순간의 시드 write 실패가 "유령 preferences" 버그의 방아쇠였다 — 상세는 [포스트모템](../internal/2026-07-notices-picker-ghost-state.md) 참조.

### 해결 (commit `78985ee`)

`apps/mobile/src/services/app-check-prime.ts` **단일 모듈**로 통합 (notifications/bookmarks/feedback에 있던 3중 사본 제거):

- 강제 갱신은 일정 주기(파일의 `FORCE_REFRESH_INTERVAL_MS`, 작성 시점 기준 5분)에 한 번만. 그 사이 write는 `getToken(false)` — SDK가 유효한 캐시 토큰을 재사용하므로 Integrity 호출이 발생하지 않는다.
- 갱신 타임스탬프는 모듈 레벨 단일 상태 — 모든 write 경로가 이 함수를 공유해야 스로틀 예산이 합산 관리된다 (**파일별 사본 금지**).
- 애초에 write 전에 토큰을 챙기는 이유(stale 토큰 → pending-writes 큐 갇힘 SDK 버그)와 트레이드오프 전문은 `app-check-prime.ts` 상단 주석이 권위.

> [!WARNING]
> Play Integrity 실경로 검증은 Android **beta 프로파일** 빌드로만 가능하다 — dev 빌드는 debug provider라 무효.

## 관련 문서

- [internal/2026-07-notices-picker-ghost-state.md](../internal/2026-07-notices-picker-ghost-state.md) — 스로틀이 방아쇠였던 유령 preferences 포스트모템
- [fcm-architecture.md](fcm-architecture.md) — App Check가 보호하는 Firestore write 경로들 (preferences/devices)
