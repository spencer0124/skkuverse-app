---
title: Mini App Platform Plan
type: plan
status: draft
owner: zoyoong124@gmail.com
last-updated: 2026-07-22
audience: internal
---

# 미니앱 플랫폼 기획

> 한 줄 요약: SKKU 동아리·기관이 skkuverse 인프라로 **푸시 알림을 보낼 수 있는 webview 미니앱**을 만드는 방식 — 업계 사례, 채택 모델, 동아리·개발자 온보딩 흐름. 앱측 구현 결정은 [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md)을 본다.

> [!NOTE]
> 이 문서는 **기획(product)** 이다. "무엇을·왜"를 다룬다. "앱에서 무엇을 준비하고 backward-compat를 어떻게 보장하는가"(how)는 짝 문서 [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md)에 있다.

## Context

미니앱의 핵심 가치 제안은 하나다: **동아리가 자체 앱도, 자체 푸시 인프라도 없이, skkuverse를 배포·알림 채널로 빌려 쓴다.** 동아리는 웹페이지(공지·모집·행사 페이지 등)만 있으면 되고, "구독한 학생에게 푸시 보내기"라는 가장 어려운 부분을 skkuverse가 대신한다.

제약과 선택:

- **솔로 개발** → native 미니앱(별도 심사·런타임·SDK)을 감당할 수 없다. **webview-only**로 한정 → 브라우저 샌드박스를 공짜로 상속하고, 커스텀 JS 런타임을 만들 필요가 없다.
- **푸시 인프라는 이미 있다** → skkuverse는 공지 푸시를 위해 FCM 토큰 멀티캐스트 파이프라인을 이미 운영한다([fcm-architecture](../explanation/fcm-architecture.md)). 미니앱 푸시는 이 위에 토픽 하나와 발송 경로 하나를 얹는 문제지, 새 인프라가 아니다.
- **미니앱 하부구조도 이미 있다** → 레지스트리·딥링크·webview 렌더러가 이미 존재한다(현행 등록 목록은 서버 `src/miniapps/index.json`). 렌더러는 미니앱 전용 셸(`app/mini-app.tsx`)로 분리됐고, 푸시·양방향 브릿지가 아직 빠져 있다.

즉 이 기획은 "새로 짓기"가 아니라 **"있는 조각을 이어 붙여 계약(contract)으로 승격하기"** 다.

## 업계 사례 비교

미니앱은 새 발명이 아니다. 주요 슈퍼앱들이 각자의 트레이드오프로 풀어놨다. skkuverse가 어느 지점을 취할지 정하기 위한 비교.

| 플랫폼 | 런타임 | SDK 배포 모델 | 푸시 모델 | 신뢰 경계 |
| --- | --- | --- | --- | --- |
| WeChat Mini Program | 커스텀 JS 런타임(WXML/WXSS, webview 아님) | 플랫폼 강제 프레임워크 | 템플릿 메시지(유저 액션 트리거 제한) | 엄격 심사 + 카테고리 권한 |
| LINE LIFF | **webview + 호스트 호스팅 JS SDK** | `<script>`로 LIFF SDK 로드 | 별도 Messaging API(서버 발송) | 채널 단위, LIFF 앱 등록 |
| Telegram Mini Apps | webview + 호스트 호스팅 SDK(`telegram-web-app.js`) | `<script>` | 봇 API(서버 발송) | 봇 소유자 |
| Toss(앱인토스) | webview 중심 + 네이티브 브릿지 | 파트너 SDK | 서버 발송(파트너 승인) | 파트너 심사 |
| KakaoTalk 채널 | 채널(웹/톡) | — | 채널 메시지(서버 발송) | 채널 인증 |

**skkuverse 채택 포지션 = "LIFF 유사".** 근거:

- webview + **호스트(=skkuverse)가 JS SDK를 호스팅** → 구버전 앱을 SDK 레벨에서 shim할 수 있다(backward-compat의 핵심, ADR 0006 §Decision-3).
- 푸시는 webview JS가 직접 쏘지 않고 **서버(관리 콘솔)에서 발송** → webview는 신뢰 불가 환경이므로 발송 권한을 클라에 두지 않는다.
- 커스텀 런타임(WeChat형)은 솔로 개발 범위 밖 → webview로 반경을 좁힌다.

## skkuverse 미니앱이란

한 미니앱 = 다음 3요소의 묶음이다.

1. **등록된 slug** — 안정적 kebab-case id. 딥링크 `/m/<id>`, 캐시 키, 애널리틱스 id를 겸한다(스키마 정의는 `packages/shared/src/miniapps/schema.ts`).
2. **`startUrl` 웹앱** — webview가 여는 홈 URL. 동아리가 제공하는 웹페이지.
3. **(선택) `miniapp:<id>` 푸시 토픽** — 유저가 opt-in하면 이 토픽으로 구독되고, 동아리가 콘솔에서 이 토픽으로만 발송한다.

현행 등록 미니앱들(목록은 서버 `src/miniapps/index.json`)은 이미 1·2를 갖춘 **이 형태의 축소판**이다 — 아직 3(푸시)과 양방향 브릿지가 없을 뿐이다.

> [!NOTE]
> 2026-08-01: 레지스트리가 서버로 이전됐다(`GET /miniapps`, `GET /miniapps/:id`). 클라 번들 JSON·번들 로고는 삭제됐고, 미니앱 추가는 이제 **앱 릴리스 없이 서버 배포만으로** 된다 — 위 워크플로 2단계의 전제가 실제로 성립한다. 상세는 [ADR 0006](../decisions/0006-miniapp-webview-push-architecture.md) §Decision-2.

## 동아리 관점 워크플로 (Phase 1 · curated)

Phase 1에서는 개발자가 게이트키퍼다. 동아리는 코드를 짜지 않는다.

1. **제출** — 동아리가 미니앱 이름·로고·웹앱 URL(`startUrl`)·설명을 폼으로 제출.
2. **등록** — 개발자가 레지스트리에 항목 추가(`index.json` + `details/<id>.json`). server-driven 전환 후에는 앱 릴리스 없이 반영(ADR 0006 §Decision-2).
3. **콘솔 계정 발급** — 개발자가 해당 동아리에 관리 콘솔 계정을 발급. 이 계정은 **자기 `miniapp:<id>` 토픽으로만** 발송 권한을 가진다.
4. **발송** — 동아리가 콘솔에서 제목·본문(다국어)·(선택)딥링크를 작성하고 "보내기". 서버가 payload를 검증하고 `miniapp:<id>` 구독자에게 멀티캐스트.

```text
[동아리]              [개발자]                 [skkuverse 서버]
 웹앱 URL 제출  ──▶  레지스트리 등록      
                     콘솔 계정 발급   ──▶   miniapp:<id> 스코프 바인딩
 콘솔에서 작성·발송 ───────────────────▶   sendNotification(type:'miniapp')
                                            → miniapp:<id> 구독 디바이스 멀티캐스트 → 학생 폰
```

> [!NOTE]
> Phase 1은 "no-code 발송"이 핵심 UX다. 동아리는 백엔드 서버가 없어도 콘솔만으로 푸시를 보낸다. per-club API 키(자체 서버에서 호출)는 Phase 2+ 옵션으로 열어둔다(ADR 0006 §Decision-7).

## 개발자(동아리 웹 제작자) 관점 — 미니앱 SDK

동아리 웹앱이 앱 안에서 더 잘 동작하려면(공유·햅틱·알림 opt-in·네이티브 내비 등) skkuverse 미니앱 SDK를 붙인다. **발송이 아니라 UX 브릿지**임에 주의 — 푸시 "발송"은 콘솔/서버의 몫이다.

```html
<!-- skkuverse가 호스팅하는 SDK. 동아리가 번들하지 않는다(구버전 앱 shim 가능). -->
<script src="https://skkuverse.com/miniapp-sdk/v1.js"></script>
```

```ts
// 웹앱 부팅 시
await sdk.ready(); // web:ready 핸드셰이크

// 버전 협상 — 반드시 feature-detect 후 사용 (구버전 호스트에서 graceful degrade)
const caps = await sdk.getCapabilities();
// caps = { sdkVersion: '1.x', supports: ['share', 'haptic', 'notificationOptIn', ...] }

if (caps.supports.includes('share')) {
  shareButton.onclick = () => sdk.share({ url: location.href });
}

if (caps.supports.includes('notificationOptIn')) {
  // 유저가 이 동아리 푸시를 구독하도록 요청 (앱 chrome의 bell과 동일 결과)
  subscribeButton.onclick = () => sdk.requestNotificationOptIn();
}
```

핵심 계약(전체 스펙은 ADR 0006):

- **메시지가 처리된다고 가정하지 말 것.** webview 밖(일반 브라우저)이나 구버전 호스트에서 호출은 조용히 no-op이다. 항상 `getCapabilities()`로 확인하고 없으면 우회 동작(웹 표준 공유 등)으로 degrade.
- **SDK는 skkuverse가 호스팅** → 계약이 동아리 코드에 박제되지 않는다. 호스트가 구버전 앱을 shim한다.
- **푸시 발송 API는 SDK에 없다** — webview JS는 신뢰 불가. 발송은 콘솔 로그인(서버 스코프) 경유.

## 푸시 구독 UX (유저 관점)

- 유저가 미니앱을 열면 chrome에 **bell 토글**이 있다(공지 탭의 bell 미러 — Toss 패턴: 맥락형 진입은 전역 구독으로 연결). 켜면 `miniapp:<id>` 토픽에 opt-in.
- opt-in은 `users/{uid}/preferences/main`의 intent write로 이어지고, 기존 derive→devices sync 체인이 그대로 구독을 반영한다([fcm-architecture](../explanation/fcm-architecture.md)).
- 동아리가 발송하면 배너 → 탭하면 해당 미니앱으로 재진입(기존 `pendingMiniAppLink` consumer 재사용, ADR 0006 §Decision-8).

## 로드맵

| Phase | 온보딩 | 발송 | 새로 여는 계약 표면 |
| --- | --- | --- | --- |
| 1 (curated) | 개발자가 등록 | no-code 콘솔 | 레지스트리 remote, `miniapp:<id>` 토픽, 콘솔↔CF payload |
| 2 (self-serve 브릿지) | 동아리 웹앱 자체 제작 + origin allowlist | 콘솔 + (선택) per-club API 키 | 미니앱 SDK 공개 계약, origin 게이트 심사 |
| 3 (셀프서비스 온보딩) | 동아리가 콘솔에서 직접 신청·등록 | 위와 동일 | 등록 워크플로 자동화, 정지·삭제 정책 |

각 단계는 이전 단계의 계약을 **깨지 않고 확장**하는 것이 원칙이다(additive-only, ADR 0006 §Backward-compat).

## 오픈 퀘스천

- **콘솔 인증** — 어떤 방식으로 동아리 계정을 인증/격리할지(Firebase Auth custom claim vs 별도 콘솔 세션).
- **남용 방지** — 발송 rate-limit, 스팸/부적절 콘텐츠 신고·차단, 발송 이력 감사.
- **라이프사이클** — 미니앱 정지·삭제 시 토픽 구독자·발송 권한 처리.
- **self-serve 심사 기준** — Phase 2에서 3rd-party origin을 허용할 때의 보안·콘텐츠 심사 체크리스트.

## 관련 문서

- [ADR 0006 — 미니앱 webview·푸시 아키텍처](../decisions/0006-miniapp-webview-push-architecture.md) — 앱측 구현 결정과 backward-compat 전략(짝 문서)
- [explanation/fcm-architecture.md](../explanation/fcm-architecture.md) — 현행 FCM 토큰 멀티캐스트·토픽 파생
- [reference/deep-link.md](../reference/deep-link.md) — `/m/<slug>` 딥링크 계약
- [docs/README.md](../README.md) — 문서 작성 규칙
