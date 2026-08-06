---
title: Mini App Webview & Push Architecture
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-22
audience: internal
---

# 0006. 미니앱 webview·푸시 아키텍처

> 한 줄 요약: webview 미니앱이 **어떤 계약 위에서 돌고**, 앱은 **무엇을 준비하며**, 앱 버전과 lockstep이 불가능한 외부 웹 콘텐츠의 **backward-compatibility를 어떻게 보장하는가**. 제품·기획 맥락은 [미니앱 플랫폼 기획](../plans/miniapp-platform.md)을 본다.

## Status

Accepted — 2026-07-22. **§Decision-1·2는 구현 완료(2026-08-01, `feat/webview-shell-split` + 서버 `feat/webview-ssot-miniapps`).** 나머지(§3~8, SDK·푸시)는 미착수.

구현 회차에서 이 ADR 범위 밖의 결정이 하나 추가됐다 — **범용 `/webview` 셸의 origin 게이트**. 미니앱 SDK(§4)와 같은 신뢰 경계 문제지만 대상이 다르다(1st-party SPA vs 임의 외부 페이지). 아래 §Decision-9 참조.

## Context

skkuverse에 **푸시 가능한 webview 미니앱**을 추가한다(동기·사례는 [기획 문서](../plans/miniapp-platform.md)). 솔로 개발이라 webview-only, 3rd-party는 단계적으로 연다(Phase 1 curated → Phase 2 self-serve).

핵심 난점은 기능이 아니라 **backward-compatibility**다. 미니앱은 **앱 버전과 lockstep 업데이트가 불가능한 외부 웹 콘텐츠**다. 동아리가 특정 시점의 계약에 맞춰 미니앱을 만들면, 구버전 앱을 깐 유저 앞에서도 계속 동작해야 한다. 이건 기능 문제가 아니라 **플랫폼 SDK 버저닝 문제**이며, 아키텍처 선택이 곧 이 문제의 답이다.

### 탐색으로 확인한 기존 자산 (재사용 대상)

미니앱 하부구조는 이미 상당 부분 존재한다. 이 ADR은 "새로 짓기"가 아니라 "잇고 계약화하기"다.

| 조각 | 위치 | 현재 상태 |
| --- | --- | --- |
| 미니앱 레지스트리 | ~~`packages/shared/src/miniapps/{schema,repository,index.json,details/*}`~~ → **서버 `src/miniapps/`** | **구현됨** — `GET /miniapps`, `GET /miniapps/:id`. 클라 번들 JSON 삭제, `assertValidRegistry`는 서버 부팅 시 fail-loud |
| server-driven 전환 seam | `packages/shared/src/miniapps/repository.ts` `miniAppRepository` alias | `remoteMiniAppRepository`로 flip하도록 주석까지 준비 |
| 미니앱 렌더러 | ~~`apps/mobile/app/in-app-browser.tsx`~~ → **`apps/mobile/app/mini-app.tsx`** | **구현됨** — 레지스트리 등록 미니앱 전용. 임의 URL은 `app/webview.tsx`로 분리 |
| 딥링크 | `apps/mobile/app/+native-intent.tsx` `MINIAPP_PATH_RE` | `skkuverse://m/<slug>` 라우팅됨 |
| pending holder + consumer | `apps/mobile/src/lib/pending-mini-app-link.ts` + `app/_layout.tsx` | **이미 존재** — 푸시 tap 라우팅 재사용 가능 |
| WebView↔RN protocol 씨앗 | `apps/mobile/src/features/mini-app/protocol.ts` | 정의됐으나 미배선 (page-extraction 부분은 온디바이스 AI 제거로 dead code — 삭제 후보) |
| 1st-party 브릿지 | `packages/bridge/` | web→app만 배선, native→web은 placeholder |
| 푸시 delivery CF | `functions/src/send-notification.ts` | `switch(body.type)`에 `case 'notice'`만. 단일 `FCM_API_KEY`, **임의 caller가 임의 topic 타게팅 가능** |
| 토픽 파생 | `functions/src/notifications/{derive,tabsContract}.ts` | topic = Firestore 라벨. `array-contains-any` 멀티캐스트 |
| 푸시 tap 라우팅 | `apps/mobile/src/services/notification-router.ts` | `navigateFromNotification`에 `case 'notice'`만 |

> [!NOTE]
> 결정적 사실: skkuverse "topic"은 native FCM 구독이 아니라 `devices` 문서의 `subscribedTopics` **라벨**이고, 발송은 `array-contains-any` 토큰 멀티캐스트다([fcm-architecture](../explanation/fcm-architecture.md)). 따라서 미니앱 푸시 = (1) `miniapp:<id>` 토픽 프리픽스 + (2) CF·router의 `miniapp` case + (3) 동아리별 발송 스코프(신규 보안 경계)의 조합이다.

## Decision

### 1. 렌더러 재사용 (구현됨)

신규 화면을 만들지 않고 기존 인앱 브라우저를 미니앱 호스트로 승격한다. 이미 레지스트리 구동·chrome·딥링크를 갖췄다.

구현 시 한 가지가 추가로 드러났다: 그 화면은 **미니앱 셸이자 동시에 임의 외부 링크 뷰어**였다. `openInAppBrowser()`가 `openMiniApp()`의 한 줄 래퍼여서, 공지 원문·마크다운 링크·SDUI `external`이 전부 북마크 버튼과 "홈 화면에 추가"가 달린 미니앱 셸로 들어갔다. 승격은 곧 **분리**를 뜻했다:

- `app/mini-app.tsx` — 레지스트리 등록 미니앱 전용. slug만 라우트를 건너고 나머지는 레지스트리에서 해석.
- `app/webview.tsx` — 그 외 모든 URL. 최소 chrome(네이티브 헤더 + 콘텐츠 + 광고 배너).
- `openInAppBrowser()`는 삭제. 두 문을 다시 흐릴 헬퍼를 남기지 않는다.

### 2. 레지스트리 server-driven 전환 (구현됨)

`miniAppRepository`를 `remoteMiniAppRepository`로 flip한다(seam은 이미 존재). → **앱 릴리스 없이 미니앱 온보딩**. 계약 규율:

- 스키마는 **additive-only**. 필드 제거·의미 변경 금지.
- breaking change는 `MINIAPP_REGISTRY_VERSION` 게이트로만.
- 클라는 **unknown 필드를 무시**(forward-compat) — 신버전 서버가 내려준 새 필드를 구버전 앱이 만나도 죽지 않는다.

### 3. 미니앱 SDK = skkuverse 호스팅 (backward-compat 핵심)

동아리는 SDK를 번들하지 않고 `<script src="https://skkuverse.com/miniapp-sdk/vN.js">`로 로드한다(LIFF 모델). → **skkuverse가 구버전 앱을 SDK 레벨에서 shim**할 수 있다. 계약이 동아리 코드에 박제되지 않는 것이 이 선택의 전부다.

### 4. native 브릿지 = 미니앱 전용 채널

`protocol.ts` 씨앗을 `in-app-browser.tsx`의 `onMessage` + `injectedJavaScriptBeforeContentLoaded`에 배선한다.

- **등록된 `startUrl` origin으로 게이트** — 화이트리스트 origin에서 온 메시지만 처리.
- **capability-scoped** — 미니앱은 허용된 메시지 집합만 호출 가능.
- 1st-party `@skkuverse/bridge`와 **분리**한다 — 신뢰 경계가 다르다(1st-party는 신뢰, 3rd-party 미니앱은 불신). Phase 1 curated에서 일부 코드는 공유해도 되나, **경계는 코드가 아니라 origin·capability로 긋는다**.

### 5. 버전 협상 handshake

미니앱은 `getCapabilities()`로 호스트 SDK 버전·지원 메시지 집합을 질의하고 **feature-detect 후 graceful degrade**한다. `postToApp`은 webview 밖/구버전 호스트에서 no-op이므로, "메시지가 처리된다"는 가정을 계약으로 금지한다. → SDK v3용 미니앱이 SDK v1 앱에서도 축소 동작한다.

### 6. 푸시 구독 — `miniapp:<id>` 토픽

신규 토픽 프리픽스 `miniapp:<id>`를 도입한다.

- `deriveSubscribedTopics`(`functions/src/notifications/derive.ts`)와 `tabsContract.ts`에 파생 규칙 추가(또는 별도 `miniAppSelections` intent 필드 — 구현 시 결정).
- 유저의 bell 토글이 `preferences/main` intent write → 기존 derive→sync 체인이 `devices.subscribedTopics`에 반영. **푸시 파이프라인 자체는 손대지 않는다.**

### 7. 푸시 origination — no-code 콘솔 + 서버 스코프

skkuverse 호스팅 관리 콘솔에서 동아리가 작성·발송한다. 콘솔 백엔드가 신규 payload로 CF를 호출한다.

```ts
// functions/src/types.ts 에 추가할 형태 (예시)
interface MiniAppNotificationPayload {
  type: 'miniapp';
  miniAppId: string;      // 스코프 키
  title_ko: string;
  body_ko: string;
  title_en?: string | null;
  body_en?: string | null;
  // topics 는 caller가 못 정한다 — 서버가 miniapp:<miniAppId> 로 강제
}
```

- **서버가 topic을 `miniapp:<miniAppId>`로 강제** → 현행 "any key → any topic" 갭을 여기서 닫는다. 동아리는 자기 토픽 외로 발송 불가.
- 동아리 인증 = **콘솔 로그인**. raw 공유 키를 동아리에 노출하지 않는다. per-club API 키(자체 서버 호출)는 Phase 2+ 옵션.

### 8. CF·tap 라우팅 확장

- `functions/src/send-notification.ts`에 `case 'miniapp'` + 형제 핸들러 `handle-miniapp.ts`(`handle-notice.ts` 미러: 로케일 버킷팅, `Record<string,string>` data, 멀티캐스트, 토큰 정리).
- `apps/mobile/src/services/notification-router.ts` `navigateFromNotification`에 `case 'miniapp'` → `router.navigate('/(tabs)/home')` + `pendingMiniAppLink.set({ id })`. **기존 `PendingMiniAppLinkConsumer`를 그대로 재사용.**

### 9. 범용 `/webview` origin 게이트 (구현됨 — 구현 회차 추가 결정)

§1의 분리로 **임의 외부 페이지가 처음으로 `/webview`에 도달**하게 됐다. 그 화면은 그때까지 1st-party SPA(분실물·버스 안내)만 받았고, 그 전제 위에서 어떤 메시지든 무조건 처리했다 — `web:open-url` → `Linking.openURL(msg.url)`, `web:navigate` → `router.push(msg.path)`. 공지 원문을 여기로 보내는 순간 그 전제가 깨진다. 그래서 게이트는 이 변경의 후속이 아니라 **전제조건**이다.

- **capability는 로드된 문서의 origin으로 결정한다** — 화면을 연 호출부가 아니라. 웹뷰는 이동하므로, 열 때 부여한 권한은 아무도 검증하지 않은 origin에서 계속 살아있게 된다. 따라서 `event.nativeEvent.url` 기준으로 **메시지마다** 재평가한다.
- **allowlist는 서버 소유** — `GET /app/config` → `webview.bridgeOrigins` (서버 `src/infra/origins.ts` `BRIDGE_ORIGINS`). 호출부가 넘기는 capability prop은 두 번째(그리고 낡은) SSOT가 된다.
- **fail-closed** — 설정 미수신·fetch 실패·파싱 불가·origin 불일치 → `[]`. 이 패키지의 다른 fallback 방향(`useCampusSections`가 실패 시 defaults를 주는 것)과 **의도적으로 반대**다. 빈 탭보다 낡은 탭이 낫지만, 여기서 관대하게 실패하면 검증 안 된 페이지에 `Linking.openURL`을 넘기게 된다.
- **`web:navigate`는 grant 집합에서 제외** — `apps/webview`가 한 번도 보낸 적 없는데 핸들러만 무방비로 살아있었다. path allowlist 없이 되살리지 말 것.

> [!WARNING]
> 이 게이트가 못 막는 것: Android에서 child iframe이 bridge로 post할 수 있는데 `nativeEvent.url`은 **top-level 문서**를 가리킨다. 즉 allowlist된 1st-party 페이지가 신뢰 불가 iframe을 embed하면 권한이 새어나간다. 현재 유일한 bridged origin인 자체 SPA는 그런 iframe이 없지만, 이는 코드가 아니라 **allowlist의 불변식**이다 — `BRIDGE_ORIGINS`에 항목을 추가하는 것이 신뢰 결정인 이유.

## Backward-compatibility 원칙

이 ADR의 심장. 미니앱 계약이 앱 버전을 가로질러 살아남게 하는 규율.

- **제품은 코드가 아니라 계약이다.** 3개 계약 표면을 각각 버전 + additive-only로 관리한다:
  1. 레지스트리 스키마(`schema.ts`, `MINIAPP_REGISTRY_VERSION`)
  2. 미니앱 SDK 메시지 집합(§Decision-4·5)
  3. 푸시 payload + 토픽 네이밍(§Decision-6·7)
- **호스트 호스팅 SDK**(§3)로 구버전 앱을 shim → 계약 진화의 부담을 앱 릴리스에서 떼어낸다.
- **capability negotiation**(§5)으로 신규 SDK 대상 미니앱이 구버전 앱에서도 degrade 동작.
- **danger zone = app-version-bound 표면.** native 브릿지 핸들러·tap 라우팅·`notification-router`는 JS라 대부분 OTA 가능하지만, **OTA 미수신 유저**가 위험하다. 대응:
  - webview **채널 + handshake는 바이너리에 조기 탑재**(핸들러 로직은 OTA로 반복 개선).
  - 푸시 tap `miniapp` case는 **어떤 동아리가 발송하기 전에 먼저 배포**한다. 미배포 앱에서 unknown type은 **no-op degrade**(배너는 OS가 그대로 노출, 탭이 무동작일 뿐 크래시 없음).

## Consequences

- (+) 인프라 재사용 최대 — 렌더러·딥링크·pending consumer·FCM 파이프라인·레지스트리 seam을 그대로 잇는다.
- (+) 레지스트리 remote 전환으로 **앱 릴리스 없는 온보딩**.
- (+) 서버 토픽 스코프(§7)가 현행 "any key → any topic" 보안 갭을 닫는다.
- (−) **신규 보안 경계가 유일 방어선** — 콘솔 인증 + 서버 토픽 스코프. Firestore Rules처럼 중간 검증 계층이 없으므로([ADR 0005](0005-user-firebase-public-mongodb.md)) `functions` verify 스크립트(emulator)로 스코프 불변식을 고정해야 한다.
- (−) 크로스-레포 계약 미러 1건 추가 — 콘솔 ↔ CF `MiniAppNotificationPayload`([add-notice-tab](../how-to/add-notice-tab.md)의 미러 패턴과 동류).
- (−) origin 게이트·capability 집합을 Phase 2 self-serve에서 심사·유지해야 한다.

### 반려한 대안

- **동아리가 SDK 번들** — 계약이 빌드 시점에 박제되어 구버전 앱 shim 불가. §3의 반대라 반려.
- **1st-party `@skkuverse/bridge` 재사용** — 신뢰 경계가 다른데(3rd-party 불신) privileged 메시지를 노출할 위험. §4에서 분리.
- **클라(webview JS)가 직접 푸시 발송** — webview는 신뢰 불가 환경. 발송 권한을 클라에 두면 임의 스팸이 가능. §7에서 서버 스코프로 반려.
