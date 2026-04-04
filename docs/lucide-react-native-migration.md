# Lucide React Native 아이콘 마이그레이션

## 개요

`@expo/vector-icons` (MaterialIcons, Ionicons) 및 커스텀 SVG 아이콘을 `lucide-react-native`로 전면 교체.

- **이전**: `@expo/vector-icons` v15 (폰트 기반) + 커스텀 `react-native-svg` 인라인 아이콘
- **이후**: `lucide-react-native` v1.7 (SVG 컴포넌트 기반, 트리 셰이킹 지원)

## 변경 사항

### 패키지

| 패키지 | 변경 |
|--------|------|
| `mobile` | `lucide-react-native` 추가, `@expo/vector-icons` 제거 |
| `@skkuverse/sds` | `lucide-react-native` 추가 |

### 아이콘 매핑

#### MaterialIcons → Lucide

| 기존 | Lucide | 사용처 |
|------|--------|--------|
| `map` | `Map` | 탭 바 (캠퍼스) |
| `near-me` | `Navigation` | 탭 바 (교통) |
| `arrow-back` | `ArrowLeft` | 네비게이션 바 뒤로가기 |
| `chevron-right` | `ChevronRight` | 리스트 화살표 |
| `chevron-left` | `ChevronLeft` | 주간 네비게이션 |
| `info-outline` | `Info` | 정보 버튼/배너 |
| `refresh` | `RefreshCw` | 새로고침 FAB |
| `campaign` | `Megaphone` | 공지 배너 |
| `close` | `X` | 닫기 버튼 |
| `pause-circle-outline` | `CirclePause` | 운행중단 상태 |
| `error-outline` | `CircleAlert` | 에러 상태 |
| `warning-amber` | `TriangleAlert` | 경고 배너 |

#### Ionicons → Lucide

| 기존 | Lucide | 사용처 |
|------|--------|--------|
| `chevron-back` | `ChevronLeft` | 검색 뒤로가기 |
| `close-circle` | `XCircle` | 검색 입력 클리어 |
| `grid-outline` | `LayoutGrid` | 빈 상태 아이콘 |
| `search-outline` / `search` | `Search` | 검색 아이콘 |
| `chevron-down` / `chevron-up` | `ChevronDown` / `ChevronUp` | 섹션 접기/펼치기 |
| `business-outline` / `business` | `Building2` | 건물 아이콘 |
| `chevron-forward` | `ChevronRight` | 리스트 화살표 |
| `location-outline` | `MapPin` | 공간 위치 아이콘 |
| `swap-vertical-outline` | `ArrowUpDown` | 엘리베이터 접근성 |
| `accessibility-outline` | `Accessibility` | 장애인 화장실 |
| `options-outline` | `SlidersHorizontal` | 필터 버튼 |

#### SDS 커스텀 SVG → Lucide

| 컴포넌트 | 기존 | Lucide |
|----------|------|--------|
| `SearchField` | 커스텀 SearchIcon SVG | `Search` |
| `SearchField` / `TextField` | 커스텀 ClearIcon SVG (filled circle + X) | `XCircle` (fill 적용) |
| `NumericSpinner` | 커스텀 MinusIcon / PlusIcon SVG | `Minus` / `Plus` |
| `Rating` | 커스텀 StarIcon SVG | `Star` (fill 적용, strokeWidth=0) |
| `ErrorPage` | 커스텀 WarningIcon SVG (64px) | `CircleAlert` |
| `Toast.Icon` | 커스텀 check/error/warning/info SVG | `CircleCheck` / `CircleX` / `CircleAlert` / `Info` (fill 적용) |

## 사용법

```tsx
// 기존
import { Ionicons } from '@expo/vector-icons';
<Ionicons name="search" size={18} color="#6B7684" />

// 변경 후
import { Search } from 'lucide-react-native';
<Search size={18} color="#6B7684" />
```

### Props

| Prop | 타입 | 설명 |
|------|------|------|
| `size` | `number` | 아이콘 크기 (px) |
| `color` | `string` | stroke 색상 |
| `fill` | `string` | 내부 채우기 색상 (기본값: `"none"`) |
| `strokeWidth` | `number` | 선 두께 (기본값: `2`) |
| `absoluteStrokeWidth` | `boolean` | size에 관계없이 고정 선 두께 |

### 새 아이콘 추가

[Lucide 아이콘 목록](https://lucide.dev/icons/)에서 필요한 아이콘을 찾아 import하면 됩니다.

```tsx
import { Bell, Settings, User } from 'lucide-react-native';
```

트리 셰이킹이 자동 적용되어, import한 아이콘만 번들에 포함됩니다.

## 변경된 파일 목록

### Mobile App (`apps/mobile/`)
- `app/(tabs)/_layout.tsx`
- `app/map/hssc.tsx`
- `app/map/hssc-credit.tsx`
- `app/webview.tsx`
- `src/features/search/SearchScreen.tsx`
- `src/features/search/components/SectionHeader.tsx`
- `src/features/search/components/BuildingResultRow.tsx`
- `src/features/search/components/SpaceResultRow.tsx`
- `src/features/building/components/BuildingHeader.tsx`
- `src/features/building/components/FloorTile.tsx`
- `src/features/bus/BusListItemRow.tsx`
- `src/features/bus/NoticeBanner.tsx`
- `src/features/bus/realtime/NavigationBar.tsx`
- `src/features/bus/realtime/RefreshFab.tsx`
- `src/features/bus/schedule/StatusCards.tsx`
- `src/features/bus/schedule/NoticeBar.tsx`
- `src/features/bus/schedule/InfoBanner.tsx`
- `src/features/bus/schedule/WeekHeader.tsx`
- `src/features/map/components/SearchBar.tsx`
- `src/features/map/components/FilterButton.tsx`

### SDS (`packages/sds/`)
- `src/components/search-field/SearchField.tsx`
- `src/components/text-field/TextField.tsx`
- `src/components/numeric-spinner/NumericSpinner.tsx`
- `src/components/rating/Rating.tsx`
- `src/components/error-page/ErrorPage.tsx`
- `src/components/toast/Toast.tsx`

## 참고

- `BusIcon.tsx`의 로컬 SVG 에셋 (toss_bus_*.svg)은 Lucide에 대응하는 아이콘이 없어 유지
- `react-native-svg`는 `lucide-react-native`의 peer dependency로 계속 필요
- `ListRow`의 `>` 문자 화살표는 SVG가 아닌 텍스트 기반이라 변경 대상 아님
