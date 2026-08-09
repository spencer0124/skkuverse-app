---
title: Map Config API Specification
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: public
---

# Map Config API Specification

> `GET /map/config` 중심의 서버 주도(server-driven) 지도 레이어 계약. 지도 레이어를 추가·변경하는 서버/클라이언트 개발자가 읽는다.

## 요약

`/map/config` 시스템은 하드코딩된 캠퍼스 마커와 흩어져 있던 버스 노선 오버레이 로직을 하나의 서버 주도 레이어 레지스트리로 통합한다. 클라이언트는 앱 시작 시 레이어 정의를 받아 필터 UI를 동적으로 렌더링하고, 각 레이어의 데이터는 필요할 때 lazy 로드한다.

| 엔드포인트 | 용도 |
| --- | --- |
| `GET /map/config` | 레이어 레지스트리 + 캠퍼스 정의 |
| `GET /map/markers/campus` | 캠퍼스 건물 마커 전체 |
| (레이어별 `endpoint` 값) | polyline 좌표 데이터 |

모든 응답은 v2 envelope 포맷(`{ meta, data }`)을 따른다.

## `GET /map/config` — 레이어 레지스트리 + 캠퍼스 정의

캠퍼스 정의와 사용 가능한 지도 레이어 목록을 반환한다.

### 요청 헤더

| 헤더 | 값 | 필수 | 설명 |
| --- | --- | --- | --- |
| `Accept-Language` | `ko` \| `en` \| `zh` | 아니오 | 로케일 (기본 `ko`) |
| `If-None-Match` | 이전 ETag 값 | 아니오 | 조건부 요청 (캐시 검증) |

### 응답 헤더 (필수)

| 헤더 | 설명 |
| --- | --- |
| `ETag` | opaque string (예: content hash 또는 `"{version}:{timestamp}"`) |
| `Vary: Accept-Language` | 캐시/CDN이 로케일별로 별도 사본을 저장하도록 보장 |

### 응답 (200)

```json
{
  "meta": {},
  "data": {
    "campuses": [
      {
        "id": "hssc",
        "label": "인사캠",
        "centerLat": 37.587241,
        "centerLng": 126.992858,
        "defaultZoom": 15.8
      },
      {
        "id": "nsc",
        "label": "자과캠",
        "centerLat": 37.293580,
        "centerLng": 126.974942,
        "defaultZoom": 15.8
      }
    ],
    "layers": [
      {
        "id": "building_numbers",
        "type": "marker",
        "markerStyle": "numberCircle",
        "label": "건물번호",
        "defaultVisible": true,
        "endpoint": "/map/markers/campus?overlay=number"
      },
      {
        "id": "building_labels",
        "type": "marker",
        "markerStyle": "textLabel",
        "label": "건물이름",
        "defaultVisible": true,
        "endpoint": "/map/markers/campus?overlay=label"
      }
    ]
  }
}
```

> [!NOTE]
> 이 예시는 2026-08-09 기준 실제 `GET /map/config` 응답과 일치한다 (권위는 서버
> `src/map/map-config.data.ts`). 이전 판에는 존재하지 않는 `campus_buildings`
> 단일 레이어와 `bus_route_*` 폴리라인이 적혀 있었다 — 폴리라인은 서버에서
> 주석 처리된 상태다.
>
> **건물번호와 건물이름이 별개 레이어라는 점이 계약의 일부다.** 이벤트 기간에
> 건물번호만 숨기고 건물이름은 남기는 동작이 이 분리 위에서 성립한다
> ([eventmap-rendering.md](../explanation/eventmap-rendering.md) §8.1).

### 응답 (304)

빈 body. 클라이언트는 캐시된 config를 그대로 유지한다.

### Campus 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string | 예 | 캠퍼스 식별자 (`"hssc"` 또는 `"nsc"`) |
| `label` | string | 예 | 로케일 적용된 표시 이름 |
| `centerLat` | number | 예 | 캠퍼스 중심 위도 (WGS84) |
| `centerLng` | number | 예 | 캠퍼스 중심 경도 (WGS84) |
| `defaultZoom` | number | 아니오 | 기본 지도 줌 레벨. 기본값 `15.8` |

### Layer 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string | 예 | 레이어 고유 식별자. 클라이언트가 state key로 사용 |
| `type` | string | 예 | `"marker"` 또는 `"polyline"`. 모르는 type은 클라이언트가 무시 |
| `label` | string | 예 | 필터 UI에 표시할 로케일 적용 텍스트 |
| `defaultVisible` | boolean | 아니오 | 초기 로드 시 표시 여부. 기본값 `false` |
| `endpoint` | string | 예 | 레이어 데이터(마커 또는 좌표)를 가져올 경로 |
| `style` | object | 아니오 | 렌더링 힌트. 현재는 `color`만 지원 |

### `style` 필드

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `color` | string | `#` 없는 6자리 hex (예: `"2D8C4E"`). polyline stroke 색상 |

## `GET /map/markers/campus` — 캠퍼스 건물 마커

인사캠(HSSC)·자과캠(NSC) **전체** 건물 마커를 반환한다. 캠퍼스별 필터링은 클라이언트가 `campus` 필드로 수행한다.

### 응답

```json
{
  "meta": {},
  "data": {
    "markers": [
      {
        "id": "hssc_1",
        "code": "1",
        "name": "수선관",
        "campus": "hssc",
        "lat": 37.587361,
        "lng": 126.994479
      }
    ]
  }
}
```

### Marker 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | string | 예 | 고유 ID. 포맷 `{campus}_{code}`. 지도 마커 ID로 사용 |
| `code` | string | 아니오 | 건물 번호 (마커 캡션으로 표시) |
| `name` | string | 예 | 건물 이름 (검색/인포윈도우용) |
| `campus` | string | 예 | `"hssc"` 또는 `"nsc"`. 클라이언트가 이 값으로 필터링 |
| `lat` | number | 예 | 위도 (WGS84) |
| `lng` | number | 예 | 경도 (WGS84) |

## Polyline 오버레이 엔드포인트

클라이언트는 레이어 config의 `endpoint`에 지정된 경로에서 polyline 데이터를 기대한다.

```json
{
  "meta": {},
  "data": {
    "coords": [
      [37.587241, 126.992858],
      [37.588000, 126.993000]
    ]
  }
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `coords` | `number[][]` | 순서 있는 `[lat, lng]` 쌍 배열. 최소 2개 |

## 캐싱 전략 (ETag)

- 클라이언트는 HTTP ETag(RFC 7232)를 사용한다. 별도 version 엔드포인트 없음.
- 서버는 모든 `GET /map/config` 응답에 `ETag` 헤더를 반환한다.
- 클라이언트는 ETag를 메모리에 저장한다. cold start마다 새로 fetch.
- 앱 resume 시 클라이언트가 `If-None-Match: {stored_etag}`를 전송한다.
  - `304 Not Modified` → 캐시가 신선함, body 전송 0.
  - `200 OK` → 새 데이터, 클라이언트가 캐시와 저장 ETag를 갱신.
- 언어 변경 시 → 클라이언트가 저장 ETag를 버리고 fresh fetch.

## i18n

| 항목 | 값 |
| --- | --- |
| 로케일 결정 | 서버가 `Accept-Language` 헤더를 읽음 |
| 지원 로케일 | `ko` (기본), `en`, `zh` |
| 로케일 의존 필드 | campus `label`, layer `label` |
| 로케일 독립 필드 | `id`, `endpoint`, `style`, `type`, 좌표 |
| 필수 응답 헤더 | `Vary: Accept-Language` |

## 확장 계획 (Future Extensibility)

- 새 레이어 type (예: `"heatmap"`, `"circle"`)은 `type` 필드로 추가. 클라이언트는 모르는 type을 무시.
- `style`은 클라이언트를 깨지 않고 확장 가능 (`width`, `opacity`, `icon` 등).
- POI 카테고리 레이어(식당, ATM 등)는 추가 `"marker"` type 레이어로 — future phase.
- 계층형 필터 UI를 위한 레이어 그룹핑(`"group": "campus"`) — future phase.
- `campuses` 배열은 클라이언트 변경 없이 확장 가능 (예: 새 분교 캠퍼스).

## 관련 문서

- [sdui-campus-spec.md](sdui-campus-spec.md) — 같은 서버 주도 패턴을 쓰는 Campus 탭 UI 계약
- [../README.md](../README.md) — 문서 작성 규칙
