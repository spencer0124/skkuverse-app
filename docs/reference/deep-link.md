---
title: Deep Link Reference
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# Deep Link Reference

> `skkuverse://` 커스텀 스킴 + `https://skkuverse.com/p/...` 유니버셜 링크의 화이트리스트 계약. 딥링크 경로를 추가/변경하거나 진입 동작을 디버깅할 때 읽는다.

## 요약

외부에서 앱의 특정 화면에 진입하는 모든 딥링크는 `apps/mobile/app/+native-intent.tsx`의 `redirectSystemPath()` 하나를 거친다. 커스텀 스킴과 유니버셜 링크는 동일한 화이트리스트를 공유하며, **화이트리스트·공지 인터셉트·미니앱 인터셉트는 cold start(`initial: true`)와 warm start(`initial: false`)에 균일하게 적용된다** — untrusted 딥링크가 `/login`, `/onboarding` 같은 임의 내부 라우트로 push하는 것을 막기 위해서다. cold와 warm의 동작이 갈리는 지점은 **bare `/` 분기 단 하나**뿐이다 (아래 [Cold start vs Warm start](#cold-start-vs-warm-start) 참조).

## 설정

| 항목 | 값 | 정의 위치 |
| --- | --- | --- |
| 커스텀 스킴 | `skkuverse://` | `apps/mobile/app.config.ts` → `scheme: "skkuverse"` |
| 유니버셜 링크 | `https://skkuverse.com` + `/p/` prefix | iOS `associatedDomains`, Android `intentFilters` |
| 필터 진입점 | `redirectSystemPath()` | `apps/mobile/app/+native-intent.tsx` |
| path 정규화 | `normalizeIncomingPath()` | `packages/shared/src/utils/normalizeIncomingPath.ts` |
| 라우팅 | Expo Router 파일 기반 (별도 linking config 없음) | `apps/mobile/app/` |

유니버셜 링크는 `/p/` prefix로 홈페이지 자체 경로와 네임스페이스를 분리한다. 앱에서는 `normalizeIncomingPath()`가 `/p/`를 자동으로 스트립한 뒤 화이트리스트를 검사하므로, 아래 표의 경로는 전부 스트립 이후 기준이다.

## 허용 경로

| 커스텀 스킴 | 유니버셜 링크 | 화면 | 처리 방식 |
| --- | --- | --- | --- |
| `skkuverse://` | `https://skkuverse.com/p/` | 홈 탭 (cold는 lastTab) | bare `/` 특별 분기 |
| `skkuverse://home` | `https://skkuverse.com/p/home` | 홈 탭 | `TAB_PATHS` 매핑 |
| `skkuverse://campus` | `https://skkuverse.com/p/campus` | 캠퍼스 탭 | `TAB_PATHS` 매핑 |
| `skkuverse://transit` | `https://skkuverse.com/p/transit` | 교통 탭 | `TAB_PATHS` 매핑 |
| `skkuverse://map/hssc` | `https://skkuverse.com/p/map/hssc` | 인사캠 지도 | `ALLOWED_PATHS` 통과 |
| `skkuverse://search` | `https://skkuverse.com/p/search` | 건물/공간 검색 | `ALLOWED_PATHS` 통과 |
| `skkuverse://notices/<sourceId>/<articleNo>` | `https://skkuverse.com/p/notices/<sourceId>/<articleNo>` | 공지 상세 | `NOTICE_PATH_RE` 인터셉트 (아래 참조) |
| `skkuverse://m/<slug>` | `https://skkuverse.com/p/m/<slug>` | 미니앱 | `MINIAPP_PATH_RE` 인터셉트 (아래 참조) |

위 목록 외의 경로는 모두 홈(`/(tabs)/home`)으로 리다이렉트된다. path 파싱 중 예외가 발생해도 `try/catch`로 홈에 떨어진다.

### 동적 경로 1: 공지 상세 (`/notices/<sourceId>/<articleNo>`)

sourceId/articleNo가 동적이라 정적 화이트리스트에 enumerable하지 않으므로, `NOTICE_PATH_RE = /^\/notices\/([a-z0-9-]+)\/(\d+)$/`가 화이트리스트 검사 *전에* 패턴 매칭한다. 앵커(`^...$`)로 부분 매칭 우회를 차단한다 — 예: `/notices/cse/5847/extra`는 매치 안 되어 홈으로 리다이렉트.

> [!NOTE]
> 매치된 공지 경로는 expo-router의 정적 route handler(`app/notices/[sourceId]/[articleNo].tsx`)로 **그대로 통과하지 않는다.** `redirectSystemPath`가 `(sourceId, articleNo)` intent를 `pendingExternalNoticeLink.set(...)`에 스태시하고 `/(tabs)/notices`를 반환한다. root layout의 `PendingNoticeLinkConsumer`가 이 intent를 소비해 공지 탭 *위에* 상세 화면을 follow-up push한다 — 뒤로가기가 (링크 도착 시점에 활성이던 임의 탭이 아니라) 공지 탭에 착지하게 만들기 위한 설계다.

앱 미설치자가 유니버셜 링크를 탭하면 `skkuverse.com/p/notices/<sourceId>/<articleNo>`의 Cloudflare Pages Function이 공지 본문을 렌더한다 (OG meta + iOS smart banner + Android JS CTA fallback).

### 동적 경로 2: 미니앱 (`/m/<slug>`)

`MINIAPP_PATH_RE = /^\/m\/([a-z0-9-]+)$/`가 공지 인터셉트 다음, 화이트리스트 검사 전에 매칭한다. 공지와 같은 pending-holder 패턴:

1. **shape 검사만** 한다(`[a-z0-9-]+`). 매치되면 `pendingMiniAppLink.set({ id })`로 스태시하고 `/(tabs)/home`을 반환.
2. root layout의 `PendingMiniAppLinkConsumer`가 **레지스트리 멤버십을 여기서** 확인한다 — `queryClient.fetchQuery`로 `GET /miniapps/:id`를 조회해 성공하면 미니앱 shell을 홈 탭 위에 열고, 실패하면 조용히 버린다(이미 홈이므로 dead end 없음).

> [!NOTE]
> 멤버십 검사가 `+native-intent.tsx`에서 consumer로 옮겨간 이유: 레지스트리가 서버 소유(`GET /miniapps`)가 되면서 동기 조회가 불가능해졌다. `redirectSystemPath`는 React 트리 밖에서 앱 마운트 전에 실행되므로 await할 수 없다. 이 한 가지 질문에 답하려고 번들 사본을 남기면 서버 SSOT 전환이 무의미해지므로, await가 가능한 consumer로 옮겼다.
>
> 보안 등가성은 유지된다: unknown slug도 결국 `/(tabs)/home`에 착지하고 임의 내부 라우트로 push할 수 없다. 달라진 것은 "홈으로 리다이렉트"가 **인터셉트 전**이 아니라 **인터셉트 후 조회 실패**로 일어난다는 점뿐이다.

## 차단되는 경로 (예시)

| 경로 | 이유 |
| --- | --- |
| `/webview?url=...` | 임의 URL 로딩 방지 |
| `/bus/realtime?groupId=...` | 앱 내부 전용 화면 |
| `/bus/schedule?groupId=...` | 앱 내부 전용 화면 |
| `/login`, `/onboarding` | untrusted 딥링크의 인증/온보딩 플로우 강제 진입 방지 |
| `/sds-preview` | 개발 전용 화면 |

차단 = `/(tabs)/home` 리다이렉트. 이 필터링은 cold/warm 구분 없이 균일하게 적용된다.

## Cold start vs Warm start

`redirectSystemPath`는 Expo Router가 **외부** 딥링크를 처리할 때만 호출된다. cold와 warm의 차이는 두 가지뿐이다 — (1) 입력 형태, (2) bare `/`의 목적지.

| 구분 | `initial` | 입력 형태 | bare `/` 목적지 | 그 외 경로 |
| --- | --- | --- | --- | --- |
| Cold start (앱 꺼진 상태에서 실행) | `true` | launch URL 원본 (예: `skkuverse:///p/notices/x/y`) | `/(tabs)/<lastTab>` (MMKV-persisted Zustand sync read) | **warm과 동일** — 공지/미니앱 인터셉트 + 화이트리스트 균일 적용 |
| Warm start (백그라운드 중 딥링크 수신) | `false` | 파싱된 pathname (예: `/p/notices/x/y`) | `/(tabs)/home` | 공지/미니앱 인터셉트 + 화이트리스트 |

- **bare `/`를 특별 처리하는 이유:** 그대로 통과시키면 `app/index.tsx`의 `<Redirect href="/(tabs)/home" />`가 root Stack history에 titleless entry를 남겨 iOS long-press 뒤로가기에서 phantom 항목으로 보인다. 이를 회피하려고 redirect-only 화면을 아예 마운트하지 않게 직접 라우팅한다. 만에 하나 leak되어도 `app/_layout.tsx`의 `<Stack.Screen name="index" options={{ title: t('nav.home') }}/>` fallback 라벨로 blank를 회피한다.
- **cold에서도 필터링이 균일한 이유:** cold start만 통과시키면 untrusted 딥링크가 앱 실행 한 번으로 임의 내부 라우트(`/login` 등)에 도달할 수 있다. `+native-intent.tsx`의 화이트리스트 주석이 이 의도를 명시한다.

### 앱 내부 네비게이션

`router.push()` 등 앱 내부 네비게이션은 `redirectSystemPath`를 거치지 않으므로 화이트리스트의 영향을 받지 않는다. 단 하나의 예외적 미러: SDUI 'route' action에 bare `/`가 들어오면 `router.dismissTo('/(tabs)/home')`로 가로챈다 (`apps/mobile/src/sdui/action-handler.ts`) — 위와 같은 titleless phantom 회피.

## path 파싱 (`normalizeIncomingPath`)

Expo native-intent 문서상 `path` 파라미터는 "path나 valid URL이라는 보장이 없다". cold는 launch URL 원본, warm은 파싱된 pathname이 들어오므로 `normalizeIncomingPath()`가 `new URL(rawPath, 'skkuverse://app')`로 양쪽을 균일하게 정규화한다:

- 커스텀 스킴: `skkuverse://search` → `/search`
- 유니버셜 링크: `https://skkuverse.com/p/map/hssc` → `/p/map/hssc` → `/p/` 스트립 → `/map/hssc`
- triple-slash empty-host 형태(`skkuverse:///p/...`), query string, fragment 모두 처리
- 빈 pathname (`skkuverse://`, host-only) → `/`
- `URL` 생성 실패 시 수동 fallback (leading `/` 보정 + `?`/`#` 제거)

## 허용 경로 추가/변경

`apps/mobile/app/+native-intent.tsx`의 `ALLOWED_PATHS` 배열을 수정한다:

```ts
const ALLOWED_PATHS = ['/home', '/campus', '/transit', '/map/hssc', '/search'];
```

탭 경로는 `TAB_PATHS` 매핑에도 추가해서 그룹 경로 (`/(tabs)/<name>`)로 명시적으로 보낸다:

```ts
const TAB_PATHS: Record<string, string> = {
  '/home': '/(tabs)/home',
  '/campus': '/(tabs)/campus',
  '/transit': '/(tabs)/transit',
};
```

동적 shape가 필요하면 (`NOTICE_PATH_RE`/`MINIAPP_PATH_RE`처럼) 앵커된 정규식 + pending-holder 패턴을 따른다.

## 테스트

```bash
# 커스텀 스킴 — 허용
xcrun simctl openurl booted "skkuverse://search"
xcrun simctl openurl booted "skkuverse://map/hssc"

# 커스텀 스킴 — 차단 → 홈
xcrun simctl openurl booted "skkuverse://webview?url=https://evil.com"
xcrun simctl openurl booted "skkuverse://bus/realtime?groupId=1"

# 유니버셜 링크 (시뮬레이터에서는 AASA 없이 제한적)
xcrun simctl openurl booted "https://skkuverse.com/p/search"
xcrun simctl openurl booted "https://skkuverse.com/p/transit"
```

> [!NOTE]
> 유니버셜 링크는 `skkuverse.com/.well-known/apple-app-site-association` (iOS)과 `assetlinks.json` (Android)이 서버에 호스팅되어야 실제 동작한다. 시뮬레이터에서는 커스텀 스킴으로 테스트하는 것이 확실하다.

## 관련 문서

- [docs/README.md](../README.md) — 문서 인덱스 및 작성 규칙
- `apps/mobile/app/+native-intent.tsx` — 이 계약의 구현 SSOT (문서와 어긋나면 코드가 진실)
- `packages/shared/src/utils/normalizeIncomingPath.ts` — path 정규화 (vitest 테스트 동봉)
