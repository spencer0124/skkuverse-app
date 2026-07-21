# 딥링크 (Deep Link)

## 개요

`skkuverse://` 커스텀 스킴과 `https://skkuverse.com` 유니버셜 링크로 외부에서 앱의 특정 화면에 진입할 수 있다.
보안을 위해 `app/+native-intent.tsx`에서 화이트리스트 기반으로 허용 경로를 제한한다.
커스텀 스킴과 유니버셜 링크 모두 동일한 화이트리스트를 거친다.

## 설정

- **커스텀 스킴:** `skkuverse://` (`app.config.ts` → `scheme: "skkuverse"`)
- **유니버셜 링크:** `https://skkuverse.com` (iOS `associatedDomains`, Android `intentFilters`)
- **화이트리스트:** `app/+native-intent.tsx` → `redirectSystemPath()`
- **Expo Router** 파일 기반 라우팅이 자동으로 딥링크 경로가 됨 (별도 linking config 없음)

## 허용 경로

| 커스텀 스킴 | 유니버셜 링크 | 화면 |
|---|---|---|
| `skkuverse://` | `https://skkuverse.com/p/` | 홈 탭 |
| `skkuverse://home` | `https://skkuverse.com/p/home` | 홈 탭 |
| `skkuverse://campus` | `https://skkuverse.com/p/campus` | 캠퍼스 탭 |
| `skkuverse://transit` | `https://skkuverse.com/p/transit` | 교통 탭 |
| `skkuverse://map/hssc` | `https://skkuverse.com/p/map/hssc` | 인사캠 지도 |
| `skkuverse://search` | `https://skkuverse.com/p/search` | 건물/공간 검색 |
| `skkuverse://notices/<sourceId>/<articleNo>` | `https://skkuverse.com/p/notices/<sourceId>/<articleNo>` | 공지 상세 |

유니버셜 링크는 `/p/` prefix를 사용하여 홈페이지 자체 경로와 분리한다. 앱에서는 `/p/`를 자동으로 제거한 뒤 화이트리스트를 검사한다.

위 목록 외의 경로는 모두 홈(`/(tabs)/home`)으로 리다이렉트된다.

### 동적 경로: 공지 상세

공지 상세는 `/notices/<sourceId>/<articleNo>` 형태로 sourceId/articleNo가 동적이라 정적 화이트리스트에 enumerable하지 않다. `+native-intent.tsx`의 `NOTICE_PATH_RE = /^\/notices\/[a-z0-9-]+\/\d+$/`가 화이트리스트 검사 *전에* 패턴 매칭으로 통과시킨다. 앵커(`^...$`)로 부분 매칭 우회를 차단한다 — 예: `/notices/cse/5847/extra`는 매치 안 되어 홈으로 리다이렉트.

앱 미설치자가 유니버셜 링크를 탭하면 `skkuverse.com/p/notices/<sourceId>/<articleNo>`의 Cloudflare Pages Function이 공지 본문을 렌더한다 (OG meta + iOS smart banner + Android JS CTA fallback).

## 차단되는 경로 (예시)

| 경로 | 이유 |
|---|---|
| `/webview?url=...` | 임의 URL 로딩 방지 |
| `/bus/realtime?groupId=...` | 앱 내부 전용 화면 |
| `/bus/schedule?groupId=...` | 앱 내부 전용 화면 |
| `/sds-preview` | 개발 전용 화면 |

## 동작 원리

`redirectSystemPath`는 Expo Router가 외부 딥링크를 처리할 때만 호출된다:

- **Cold start** (앱이 꺼져있을 때 딥링크로 실행 또는 단순 앱 실행): `initial: true`로 호출됨 — **bare `/`는 `/(tabs)/<lastTab>`으로 직접 매핑** (lastTab은 MMKV-persisted Zustand에서 sync read), **그 외 path는 그대로 통과** (불필요한 OS-intent 가로채기 차단).
  - bare `/`만 특별 처리하는 이유: 그대로 통과시키면 `app/index.tsx`의 `<Redirect href="/(tabs)/home" />`가 root Stack history에 titleless 한 entry를 남겨 iOS long-press 뒤로가기에서 phantom 항목으로 보임. 이를 회피하려고 redirect-only 화면을 아예 마운트하지 않게 직접 라우팅. 만에 하나 leak되어도 `app/_layout.tsx`의 `<Stack.Screen name="index" options={{ title: t('nav.home') }}/>` fallback 라벨로 blank 회피.
  - 다른 cold-start path(예: `/notices/cse/5847` 딥링크)는 그대로 통과시켜 expo-router의 정적 route handler가 받게 둠.
- **Warm start** (앱이 백그라운드에 있을 때 딥링크 수신): `initial: false` — 화이트리스트 redirect 적용.
- **앱 내부 네비게이션** (`router.push()` 등): `redirectSystemPath` 미호출. 다만 SDUI 'route' action에 bare `/`가 들어오면 `router.dismissTo('/(tabs)/home')`로 가로채서 (`apps/mobile/src/sdui/action-handler.ts`) 위와 같은 phantom 회피.

따라서 SDUI action handler, 버스 화면 내부 이동 등 앱 내부 네비게이션은 화이트리스트 redirect의 영향을 받지 않는다.

### path 파싱

`redirectSystemPath`의 `path` 파라미터는 full URL로 들어올 수 있다:

- 커스텀 스킴: `skkuverse://search` → 스킴 벗기고 경로 추출 → `/search`
- 유니버셜 링크: `https://skkuverse.com/p/map/hssc` → 스킴+호스트 벗기고 → `/p/map/hssc` → `/p/` 제거 → `/map/hssc`

호스트에 `.`이 포함되면 도메인으로 판단하여 호스트를 제거한다. `/p/` prefix는 유니버셜 링크 네임스페이스로, 자동 스트립된다.

## 허용 경로 추가/변경

`app/+native-intent.tsx`의 `ALLOWED_PATHS` 배열을 수정한다:

```tsx
const ALLOWED_PATHS = ['/home', '/campus', '/transit', '/map/hssc', '/search'];
```

탭 경로는 `TAB_PATHS` 매핑에도 추가해서 그룹 경로 (`/(tabs)/<name>`)로 명시적으로 보낸다:

```tsx
const TAB_PATHS: Record<string, string> = {
  '/home': '/(tabs)/home',
  '/campus': '/(tabs)/campus',
  '/transit': '/(tabs)/transit',
};
```

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

> **참고:** 유니버셜 링크는 `skkuverse.com/.well-known/apple-app-site-association` (iOS)과 `assetlinks.json` (Android)이 서버에 호스팅되어야 실제 동작한다. 시뮬레이터에서는 커스텀 스킴으로 테스트하는 것이 확실하다.
