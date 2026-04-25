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

유니버셜 링크는 `/p/` prefix를 사용하여 홈페이지 자체 경로와 분리한다. 앱에서는 `/p/`를 자동으로 제거한 뒤 화이트리스트를 검사한다.

위 목록 외의 경로는 모두 홈(`/(tabs)/home`)으로 리다이렉트된다.

## 차단되는 경로 (예시)

| 경로 | 이유 |
|---|---|
| `/webview?url=...` | 임의 URL 로딩 방지 |
| `/bus/realtime?groupId=...` | 앱 내부 전용 화면 |
| `/bus/schedule?groupId=...` | 앱 내부 전용 화면 |
| `/sds-preview` | 개발 전용 화면 |

## 동작 원리

`redirectSystemPath`는 Expo Router가 외부 딥링크를 처리할 때만 호출된다:

- **Cold start** (앱이 꺼져있을 때 딥링크로 실행): `initial: true`로 호출됨 — **redirect 안 함, path 그대로 통과** (불필요한 OS-intent 가로채기 차단). 실제 라우트 매칭은 `app/index.tsx` Redirect 등 라우터-internal layer가 담당.
- **Warm start** (앱이 백그라운드에 있을 때 딥링크 수신): `initial: false` — 화이트리스트 redirect 적용.
- **앱 내부 네비게이션** (`router.push()` 등): 호출되지 않음. 단, 내부에서 `/`로 푸시될 경우 `app/index.tsx`의 `<Redirect href="/(tabs)/home" />`가 잡아서 home 탭으로 보냄.

따라서 SDUI action handler, 버스 화면 내부 이동 등 앱 내부 네비게이션은 영향받지 않는다.

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
