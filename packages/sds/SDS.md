# SDS (Skku Design System)

`@toss/tds-react-native` v2.0.2를 기반으로 만든 커스텀 디자인 시스템.

---

## TDS 원본 분석

TDS npm 패키지 (11MB, 2,739 파일, 51개 컴포넌트 패밀리)를 분석한 결과, 코드 난독화 수준이 3단계로 나뉜다.

### Readable (~18개)

prettier 돌리면 구조 파악 가능. minified 변수명만 복원하면 TS로 변환 가능.

```
Button, Badge, Switch, Checkbox, ListRow, Border,
Skeleton, Loader, ProgressBar, TextButton, IconButton,
ListHeader, ListFooter, Radio, Rating, Shadow, Agreement, StepperRow
```

**전략**: beautify → .d.ts 참고해서 변수명 복원 → TypeScript 변환

### 부분 난독화 (~15개)

구조는 보이지만 일부 핵심 로직이 암호화. .d.ts가 완벽하므로 API 계약서로 재구현.

```
Dialog, Toast, BottomSheet, BottomCTA, FixedBottomCTA,
Tab, SegmentedControl, Dropdown, Top, SearchField,
NumericSpinner, Tooltip, FullTooltip, Highlight, Gradient
```

**전략**: .d.ts 기반 재구현 (내부 로직은 직접 작성)

### XOR 문자열 암호화 (~8개)

모든 문자열이 XOR로 암호화되어 있어 해독 불가. 완전 재구현 필요.

```
Txt, TextField, Keypad (Number/FullSecure),
Carousel, BarChart, Post, ErrorPage, Result
```

**전략**: .d.ts를 API 계약서로 삼아 처음부터 재구현

### 핵심 자산 (난독화 없음)

| 자산 | 설명 |
|------|------|
| **모든 .d.ts 타입 정의** | Korean JSDoc 포함, 완벽한 API 계약서 |
| **Foundation 패키지** | colors, typography, easings, spring-easing, color-utils |
| **라이센스** | GPL-3.0 |

### Skip 대상 (10개)

Toss 내부 프레임워크(`@granite-js`) 전용 — SDS에서 불필요:

```
Bridge, ExternalWebViewScreen, PartnerWebViewScreen, PartnerNavigation,
PageNavbar, TabView, TopNavigation, Navigation, PreventFontScaling, OverlayExtension
```

---

## 핵심 결정사항

### 애니메이션 런타임 통일

TDS는 `@react-spring/native` (JS thread) 기반이지만, SDS는 **`react-native-reanimated` (UI thread) 단일 런타임**으로 통일.

- TDS spring config `{ stiffness, damping, mass }` → reanimated `withSpring` 1:1 매핑
- TDS bezier → reanimated `Easing.bezier()` 1:1 매핑
- 번들 사이즈 절약 + 성능 일관성

### granite-js 의존성 제거

TDS의 `@granite-js/native`, `@granite-js/react-native` 의존성을 완전 제거. SafeAreaProvider, Portal 등은 표준 패키지로 대체.

### 토큰 소스

`@skkuverse/shared`의 기존 토큰(SdsColors 73개, SdsTypo t1~t7 + st1~st13) 재사용.

---

## 현재 구현 상태

### 패키지 구조

```
packages/sds/                       # @skkuverse/sds
├── src/
│   ├── index.ts                    # barrel export
│   ├── foundation/
│   │   ├── easings.ts              # bezier + spring 프리셋 (TDS 클론)
│   │   ├── colors.ts               # seed color + adaptive color
│   │   └── typography.ts           # t1~t7, st1~st13 매핑
│   ├── core/
│   │   ├── SDSProvider.tsx          # 루트 Provider
│   │   ├── ThemeProvider.tsx        # seed → derived token
│   │   ├── AdaptiveColorProvider.tsx # light/dark mode
│   │   ├── TypographyProvider.tsx   # 폰트 + 스케일
│   │   └── OverlayProvider.tsx      # Dialog/Toast 포탈
│   ├── components/
│   │   ├── txt/Txt.tsx              # ✅ 재구현 (XOR 난독화)
│   │   ├── button/Button.tsx        # ✅ beautify→TS
│   │   ├── badge/Badge.tsx          # ✅ beautify→TS
│   │   ├── border/Border.tsx        # ✅ beautify→TS
│   │   ├── switch/Switch.tsx        # ✅ beautify→TS
│   │   ├── checkbox/Checkbox.tsx    # ✅ beautify→TS
│   │   ├── list-row/ListRow.tsx     # ✅ beautify→TS
│   │   ├── accordion-list/          # ✅ 재구현
│   │   ├── text-button/TextButton.tsx    # ✅ Tier 2
│   │   ├── icon-button/IconButton.tsx    # ✅ Tier 2
│   │   ├── list-header/ListHeader.tsx    # ✅ Tier 2
│   │   ├── list-footer/ListFooter.tsx    # ✅ Tier 2
│   │   ├── skeleton/Skeleton.tsx         # ✅ Tier 2
│   │   ├── loader/Loader.tsx             # ✅ Tier 2
│   │   ├── progress-bar/ProgressBar.tsx  # ✅ Tier 2
│   │   ├── search-field/SearchField.tsx  # ✅ Tier 2
│   │   ├── text-field/TextField.tsx      # ✅ Tier 2
│   │   ├── dialog/Dialog.tsx             # ✅ Tier 2
│   │   ├── toast/Toast.tsx               # ✅ Tier 2
│   │   ├── shadow/Shadow.tsx            # ✅ Tier 3
│   │   ├── radio/Radio.tsx              # ✅ Tier 3
│   │   ├── rating/Rating.tsx            # ✅ Tier 3
│   │   ├── dropdown/Dropdown.tsx        # ✅ Tier 3
│   │   ├── segmented-control/           # ✅ Tier 3
│   │   ├── tab/Tab.tsx                  # ✅ Tier 3
│   │   ├── numeric-spinner/             # ✅ Tier 3
│   │   ├── stepper-row/StepperRow.tsx   # ✅ Tier 3
│   │   ├── bottom-cta/BottomCTA.tsx     # ✅ Tier 3
│   │   ├── fixed-bottom-cta/           # ✅ Tier 3
│   │   ├── bottom-sheet/BottomSheet.tsx # ✅ Tier 3
│   │   ├── navbar/Navbar.tsx            # ✅ Tier 3
│   │   ├── gradient/Gradient.tsx        # ✅ Tier 3
│   │   ├── error-page/ErrorPage.tsx    # ✅ Tier 4
│   │   └── result/Result.tsx           # ✅ Tier 4
│   └── utils/
│       ├── useControlled.ts         # controlled/uncontrolled 패턴
│       └── mergeRefs.ts            # 다중 ref 병합
├── package.json
└── tsconfig.json
```

### Tier 1 — 완료 (8개 + Provider)

| 컴포넌트 | 전략 | 애니메이션 | 상태 |
|----------|------|-----------|------|
| **SDSProvider** | 재구현 | — | ✅ 완료 |
| **Txt** | .d.ts 재구현 | — | ✅ 완료 |
| **Button** | beautify→TS | scale down + dim overlay + loading dots pulse | ✅ 완료 |
| **Badge** | beautify→TS | — | ✅ 완료 |
| **Border** | beautify→TS | — | ✅ 완료 |
| **Switch** | beautify→TS | knob spring + 배경색 transition | ✅ 완료 |
| **Checkbox** | beautify→TS | wiggle + scale bounce | ✅ 완료 |
| **ListRow** | beautify→TS | press underlay | ✅ 완료 |
| **AccordionList** | 재구현 | expand/collapse height spring | ✅ 완료 |

### Tier 2 — 완료 (11개)

TDS 문서와 비교 검증 완료. 모든 기본값/props가 TDS 원본과 일치.

| 컴포넌트 | 전략 | 핵심 기능 | 상태 |
|----------|------|-----------|------|
| **TextButton** | beautify→TS | variant(arrow/underline/clear), fontWeight 제한, GestureResponderEvent | ✅ 완료 |
| **IconButton** | beautify→TS | variant default='clear'(TDS), scale spring, label a11y, useAdaptive | ✅ 완료 |
| **ListHeader** | beautify→TS | TitleParagraph, RightText, **RightArrow**, DescriptionParagraph, titleViewStyle/rightViewStyle | ✅ 완료 |
| **ListFooter** | beautify→TS | Title(blue500/medium), Right, borderType(full/none) | ✅ 완료 |
| **Skeleton** | beautify→TS | Animate(shimmer context), borderRadius default=6(TDS) | ✅ 완료 |
| **Loader** | beautify→TS | size default='large'(TDS), customStrokeColor/customSize/style, Delay/Centered/FullScreen | ✅ 완료 |
| **ProgressBar** | beautify→TS | withAnimation default=false(TDS), onLayout 기반 pixel 애니메이션 | ✅ 완료 |
| **SearchField** | .d.ts 재구현 | hasClearButton default=false(TDS), useControlled | ✅ 완료 |
| **TextField** | .d.ts 재구현 | labelOption(appear/sustain), floating label, box/line, Clearable compound | ✅ 완료 |
| **Dialog** | .d.ts 재구현 | Alert/Confirm, title=ReactNode, closeOnDimmerClick, onEntered/onExited | ✅ 완료 |
| **Toast** | .d.ts 재구현 | Icon(check/warning/error/info), Button, position(top/bottom), auto-dismiss | ✅ 완료 |

**TDS 비교 검증에서 수정된 항목:**
- IconButton: default variant `fill` → `clear` (TDS 일치)
- ListHeader: `RightArrow` compound 추가, `RightText` color grey500 → `grey700`
- Skeleton: borderRadius default 8 → 6
- Loader: default size `medium` → `large`, `customStrokeColor`/`customSize`/`style` 추가
- ProgressBar: withAnimation default `true` → `false`
- SearchField: hasClearButton default `true` → `false`
- TextField: `labelOption` prop 추가, line variant label left 16 → 0
- Dialog: `closeOnDimmerClick`, `onEntered` 추가, `title` string → ReactNode

**검증:**
- TypeScript 컴파일: `npx tsc --noEmit` 통과 (SDS + mobile 모두 0 에러)
- preview 화면: `apps/mobile/app/sds-preview.tsx` — 모든 상태 커버
- SDSProvider: `apps/mobile/app/_layout.tsx`에 통합

---

## 로드맵

### Tier 2 — ✅ 완료 (11개)

| 컴포넌트 | 난독화 | 전략 | 난이도 | 용도 |
|----------|--------|------|--------|------|
| **Dialog** | 부분 | .d.ts 재구현 | 중 | ✅ Alert/Confirm 다이얼로그 |
| **Toast** | 부분 | .d.ts 재구현 | 중 | ✅ 피드백 알림 |
| **Skeleton** | readable | beautify→TS | 하 | ✅ 로딩 플레이스홀더 |
| **Loader** | readable | beautify→TS | 하 | ✅ 로딩 스피너 |
| **ProgressBar** | readable | beautify→TS | 하 | ✅ 진행률 바 |
| **SearchField** | 부분 | .d.ts 재구현 | 중 | ✅ 검색 입력 |
| **TextField** | XOR 암호화 | .d.ts 재구현 | 상 | ✅ 텍스트 입력 |
| **TextButton** | readable | beautify→TS | 하 | ✅ 텍스트만 있는 버튼 |
| **IconButton** | readable | beautify→TS | 하 | ✅ 아이콘 버튼 |
| **ListHeader** | readable | beautify→TS | 하 | ✅ 리스트 섹션 헤더 |
| **ListFooter** | readable | beautify→TS | 하 | ✅ 리스트 섹션 푸터 |

### Tier 3 — 완료 (13개)

복합 인터랙션이 필요한 컴포넌트. 대부분 부분 난독화 → .d.ts 재구현.

| 컴포넌트 | 전략 | 핵심 기능 | 상태 |
|----------|------|-----------|------|
| **Shadow** | beautify→TS | useShadow hook, presets (weak/medium/strong), iOS shadow/Android elevation | ✅ 완료 |
| **Radio** | .d.ts 재구현 | Radio + Radio.Option compound, scale bounce animation, SVG circles | ✅ 완료 |
| **Rating** | .d.ts 재구현 | editable + readOnly, variant(full/compact/iconOnly), SVG star | ✅ 완료 |
| **Dropdown** | .d.ts 재구현 | Dropdown + Dropdown.Item, opacity fade animation, controlled/uncontrolled | ✅ 완료 |
| **SegmentedControl** | .d.ts 재구현 | spring indicator slide, pill background, equal width items | ✅ 완료 |
| **Tab** | .d.ts 재구현 | spring indicator, fluid scroll mode, useControlled, redBean dot | ✅ 완료 |
| **NumericSpinner** | .d.ts 재구현 | [-] number [+], useControlled, min/max limits, 4 sizes | ✅ 완료 |
| **StepperRow** | .d.ts 재구현 | NumberIcon + Texts(A/B/C) + RightArrow + RightButton, connector line | ✅ 완료 |
| **BottomCTA** | .d.ts 재구현 | safe area bottom, shadow, absolute positioning | ✅ 완료 |
| **FixedBottomCTA** | .d.ts 재구현 | BottomCTA + KeyboardAvoidingView (iOS: padding, Android: height) | ✅ 완료 |
| **BottomSheet** | .d.ts 재구현 | @gorhom/bottom-sheet wrapper, SDS handle/backdrop, Header compound | ✅ 완료 |
| **Navbar** | .d.ts 재구현 | BackButton/CloseButton/Title/TextButton compounds, 56px height | ✅ 완료 |
| **Gradient** | .d.ts 재구현 | Linear + Radial via react-native-svg, degree/position support | ✅ 완료 |

### Tier 4 — 부분 완료 (2/10개)

특수 목적. 대부분 XOR 암호화 → 완전 재구현 필요.

| 컴포넌트 | 난독화 | 난이도 | 상태 |
|----------|--------|--------|------|
| **ErrorPage** | XOR | 중 | ✅ 완료 — statusCode(400/404/500) 기반 에러 화면, SVG 아이콘, 좌/우 버튼 |
| **Result** | XOR | 중 | ✅ 완료 — figure/title/description/button 결과 화면, Result.Button compound |
| **Carousel** | XOR | 상 | 슬라이드 갤러리 |
| **BarChart** | XOR | 상 | 막대 차트 |
| **Keypad** | XOR | 상 | 숫자/보안 키패드 |
| **Post** | XOR | 상 | 리치 텍스트 |
| **Slider** | 부분 | 중 | 범위 슬라이더 |
| **Tooltip** | 부분 | 중 | 일반 툴팁 |
| **FullTooltip** | 부분 | 중 | 전체화면 툴팁 |
| **Highlight** | 부분 | 중 | 스팟라이트 오버레이 |

---

## 난이도 기준

| 난이도 | 설명 |
|--------|------|
| **하** | readable → beautify + TS 변환만으로 완성. 1~2시간 |
| **중** | .d.ts 기반 재구현 필요. 애니메이션/레이아웃 로직 직접 작성. 반나절 |
| **상** | XOR 암호화 + 복잡한 인터랙션. 완전 재구현 + 테스트. 하루 이상 |

## 전략별 요약

| 전략 | 컴포넌트 수 | 설명 |
|------|------------|------|
| **beautify→TS** | ~18개 | TDS JS를 prettier → 변수명 복원 → TS 변환 |
| **.d.ts 재구현** | ~15개 | 타입 정의를 API 계약서로 삼아 처음부터 구현 |
| **완전 재구현** | ~8개 | XOR 암호화된 코드, .d.ts만 참고 |
| **Skip** | 10개 | granite-js 전용, SDS 불필요 |

---

## Dependencies

```json
// packages/sds/package.json
{
  "dependencies": {
    "@skkuverse/shared": "*",
    "culori": "^4.0.1",
    "hex-to-rgba": "^2.0.1"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-native": ">=0.76",
    "react-native-reanimated": ">=4",
    "react-native-gesture-handler": ">=2",
    "react-native-safe-area-context": ">=5",
    "react-native-svg": ">=15"
  }
}
```

## 참고 자료

- TDS npm tarball: `/tmp/tds-inspect/package/` (로컬)
- TDS docs: MCP `docs-mcp-server`에 `tds-react-native` v2.0.2 스크랩 완료
- TDS .d.ts: 모든 컴포넌트의 완벽한 타입 + Korean JSDoc
