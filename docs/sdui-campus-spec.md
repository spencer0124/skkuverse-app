# SDUI (Server-Driven UI) — Campus Tab

캠퍼스 탭의 UI 구성을 서버에서 제어하는 섹션 템플릿 SDUI 시스템.

## Overview

서버가 `sections` 배열로 "어떤 섹션을 어떤 순서로 보여줄지" 결정하고, 클라이언트는 미리 정의된 위젯으로 각 섹션을 렌더링한다. 토스의 HomeDST에서 영감을 받은 구조이며, SKKUBUS 규모에 맞게 단순화했다.

**핵심 원칙:**
- `sections` 배열 순서 = 렌더링 순서 (서버에서 순서만 바꾸면 UI 순서 변경)
- `type` 필드가 컴포넌트 매핑 키
- 모르는 `type` → `null` 반환 (구버전 앱 크래시 방지)
- 위젯은 SDUI 컨텍스트 외에서도 하드코딩으로 재사용 가능

---

## API

### `GET /ui/home/campus`

```json
{
  "meta": { "lang": "ko" },
  "data": {
    "minAppVersion": "2.0.0",
    "sections": [
      {
        "type": "section_title",
        "id": "campus_title",
        "title": "캠퍼스 서비스"
      },
      {
        "type": "button_grid",
        "id": "campus_buttons",
        "columns": 4,
        "items": [
          {
            "id": "building_map",
            "title": "건물지도",
            "emoji": "🏢",
            "actionType": "route",
            "actionValue": "/map/hssc"
          },
          {
            "id": "lost_found",
            "title": "분실물",
            "emoji": "🧳",
            "actionType": "webview",
            "actionValue": "https://webview.skkuuniverse.com/#/skku/lostandfound",
            "webviewTitle": "분실물",
            "webviewColor": "003626"
          }
        ]
      }
    ]
  }
}
```

### `minAppVersion`

이 응답을 제대로 렌더링하기 위한 최소 앱 버전. 평소에는 모르는 type 무시로 하위호환을 유지하고, breaking change 시에만 이 값을 올려 업데이트를 유도한다. 클라이언트에서 optional로 파싱하며, 현재는 사용하지 않음.

---

## Section Types

### `button_grid`

이모지+텍스트 버튼을 N열 그리드로 배치.

| 필드 | 타입 | 설명 |
|------|------|------|
| `columns` | int | 열 수 (기본 4) |
| `items` | array | 버튼 아이템 배열 |

각 item 필드:

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 고유 식별자 |
| `title` | string | 표시 텍스트 (i18n) |
| `emoji` | string | Unicode 이모지 (Tossface 폰트로 렌더링) |
| `actionType` | string | `route` / `webview` / `external` |
| `actionValue` | string | 네비게이션 대상 |
| `webviewTitle` | string? | 웹뷰 타이틀바 텍스트 |
| `webviewColor` | string? | 웹뷰 테마 색상 (hex, # 없이) |

### `section_title`

섹션 구분 제목.

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | string | 표시 텍스트 |

### `notice`

상단 공지 바. 탭하면 액션 실행.

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | string | 공지 텍스트 |
| `actionType` | string | `route` / `webview` / `external` |
| `actionValue` | string | 네비게이션 대상 |

### `banner`

이미지 배너. 탭하면 액션 실행.

| 필드 | 타입 | 설명 |
|------|------|------|
| `imageUrl` | string | 배너 이미지 URL |
| `actionType` | string | `route` / `webview` / `external` |
| `actionValue` | string | 네비게이션 대상 |

### `spacer`

섹션 간 여백.

| 필드 | 타입 | 설명 |
|------|------|------|
| `height` | number? | 높이 (px). 기본 16 |

---

## Action Types

모든 섹션에서 동일한 액션 체계를 사용.

| actionType | 동작 | 예시 |
|------------|------|------|
| `route` | 앱 내 화면 이동 (Expo Router) | `/map/hssc`, `/search` |
| `webview` | 인앱 WebView | `https://webview.skkuuniverse.com/...` |
| `external` (또는 `url`) | 외부 브라우저/앱 | `http://pf.kakao.com/...` |

`external`과 `url`은 동일하게 처리됨 (서버 어느 쪽이든 사용 가능).

---

## Client Architecture

### 파일 구조

```
apps/mobile/src/sdui/
├── types.ts                  # Section 타입 정의 (discriminated union)
├── action-handler.ts         # 공통 액션 핸들러 (route/webview/external)
└── widgets/
    ├── index.ts              # type → Component dispatcher
    ├── ButtonGrid.tsx        # GridView 렌더링
    ├── SectionTitle.tsx      # 제목 텍스트
    ├── Notice.tsx            # 공지 바
    ├── Banner.tsx            # 이미지 배너
    └── Spacer.tsx            # 여백
```

### Discriminated Union 구조

```typescript
type SduiSection =
  | { type: 'button_grid'; id: string; columns: number; items: SduiButtonItem[] }
  | { type: 'section_title'; id: string; title: string }
  | { type: 'notice'; id: string; title: string; actionType: string; actionValue: string }
  | { type: 'banner'; id: string; imageUrl: string; actionType: string; actionValue: string }
  | { type: 'spacer'; id: string; height?: number }
```

모르는 `type`은 dispatcher에서 `null` 반환 → 렌더링하지 않음.

---

## Fallback

API 호출 실패 시 React Query의 캐시 또는 기본 데이터가 사용됨.

---

## i18n

- 서버가 `Accept-Language` 헤더 기반으로 로케일별 텍스트 반환
- 지원: `ko` (default), `en`, `zh`
- 로케일 의존 필드: `title`, `label` 등 사용자 노출 문구
- 로케일 독립 필드: `id`, `type`, `actionType`, `actionValue`, `emoji`

---

## 새 Section Type 추가하기

1. **서버**: sections 배열에 새 객체 추가
2. **클라이언트** (앱 업데이트 필요):
   - `types.ts`에 새 타입 추가
   - `widgets/`에 컴포넌트 파일 생성
   - `widgets/index.ts`의 dispatcher에 케이스 추가
3. **하위호환**: 구버전 앱은 모르는 type을 무시 → 크래시 없음

### 향후 확장 후보

| type | 설명 |
|------|------|
| `list` | 세로 목록 |
| `card` | 카드형 UI |
| `countdown` | D-day 카운트다운 |
| `carousel` | 배너 슬라이드 |
