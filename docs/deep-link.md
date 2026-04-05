# 딥링크 (Deep Link)

## 개요

`skkuverse://` 커스텀 스킴으로 외부에서 앱의 특정 화면에 진입할 수 있다.
보안을 위해 `app/+native-intent.tsx`에서 화이트리스트 기반으로 허용 경로를 제한한다.

## 설정

- **커스텀 스킴:** `skkuverse://` (`app.config.ts` → `scheme: "skkuverse"`)
- **화이트리스트:** `app/+native-intent.tsx` → `redirectSystemPath()`
- **Expo Router** 파일 기반 라우팅이 자동으로 딥링크 경로가 됨 (별도 linking config 없음)

## 허용 경로

| 딥링크 | 화면 |
|---|---|
| `skkuverse://` | 홈 (campus 탭) |
| `skkuverse://campus` | 캠퍼스 탭 |
| `skkuverse://transit` | 교통 탭 |
| `skkuverse://map/hssc` | 인사캠 지도 |
| `skkuverse://search` | 건물/공간 검색 |

위 목록 외의 경로는 모두 홈(`/(tabs)/campus`)으로 리다이렉트된다.

## 차단되는 경로 (예시)

| 딥링크 | 이유 |
|---|---|
| `skkuverse://webview?url=...` | 임의 URL 로딩 방지 |
| `skkuverse://bus/realtime?groupId=...` | 앱 내부 전용 화면 |
| `skkuverse://bus/schedule?groupId=...` | 앱 내부 전용 화면 |
| `skkuverse://sds-preview` | 개발 전용 화면 |

## 동작 원리

`redirectSystemPath`는 Expo Router가 외부 딥링크를 처리할 때만 호출된다:

- **Cold start** (앱이 꺼져있을 때 딥링크로 실행): 호출됨
- **Warm start** (앱이 백그라운드에 있을 때 딥링크 수신): 호출됨
- **앱 내부 네비게이션** (`router.push()` 등): 호출되지 않음

따라서 SDUI action handler, 버스 화면 내부 이동 등 앱 내부 네비게이션은 영향받지 않는다.

## 허용 경로 추가/변경

`app/+native-intent.tsx`의 `ALLOWED_PATHS` 배열을 수정한다:

```tsx
const ALLOWED_PATHS = ['/campus', '/transit', '/map/hssc', '/search'];
```

## 테스트

```bash
# 허용 — 해당 화면으로 이동
npx uri-scheme open "skkuverse://search" --ios
npx uri-scheme open "skkuverse://map/hssc" --ios

# 차단 — 홈으로 리다이렉트
npx uri-scheme open "skkuverse://webview?url=https://evil.com" --ios
npx uri-scheme open "skkuverse://bus/realtime?groupId=1" --ios
```
