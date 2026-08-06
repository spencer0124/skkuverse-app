---
title: Notices Feature
type: explanation
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# Notices Feature

> 한 줄 요약: 공지 탭(`apps/mobile/src/features/notices/`)의 구조와 설계 근거 — 서버 주도 탭 레이아웃, 커스텀 마크다운 렌더링, CLS 제거용 dimension hint, 날짜 그루핑, 온보딩 게이트와 자동복원 메커니즘.

## 개요

공지 기능은 "레이아웃은 서버가, 렌더링 견고함은 클라이언트가" 원칙으로 설계됐다. 탭 구성·순서·picker 소스는 전부 서버 응답이 결정하고, 클라이언트는 크롤링된 마크다운을 RN 제약(Text 안의 Animated.View 불가, 이미지 서버 Referer 요구 등)을 우회하며 안정적으로 그리는 데 집중한다. 진입은 온보딩 게이트로 막혀 있고, 기기 교체/재설치 시 Firestore의 `onboardedAt` discriminator로 자동복원된다.

## 서버 주도 탭 레이아웃

탭 구성은 `GET /notices/tabs`가 전량 내려준다. **탭의 종류·개수·순서의 권위는 서버**이며, 클라이언트는 응답을 그대로 렌더링한다 (작성 시점 기준 9탭: 학과 / 학사 / 장학 / 취업 / 모집 / 행사 / 도서관 / 기숙사 / 일반).

| 서버가 내려주는 것 | 설명 |
| --- | --- |
| 탭 종류·순서 | 응답 배열 순서 그대로 스트립에 렌더링 |
| `tabMode` | `fixed`(단일 소스) / `picker`(multi-source 선택형) |
| picker source 목록 | `picker` 탭에서 선택 가능한 소스들 (예: 학과 목록) |
| `maxSelection` | picker 다중 선택 상한 |
| `defaultIds` + `campusDefaultIds` | 미선택 시 기본값 (캠퍼스별 분기 포함) |

`tabMode: "picker"` 탭은 multi-source picker UI(BottomSheetModal, multi-select)를 띄운다. FCM 쪽에서 이 탭 키를 미러링하는 서버 계약은 `functions/src/notifications/tabsContract.ts` 참조 (source of truth는 skkuverse-server 레포의 `categories.json`).

## 마크다운 렌더링 (커스텀 NoticeRenderer)

렌더러는 `react-native-marked`(major 버전은 `apps/mobile/package.json`에서 확인)의 `Renderer`를 확장한 `NoticeRenderer` (`apps/mobile/src/features/notices/NoticeMarkdownView.tsx`). 오버라이드 3종은 각각 RN/공지 데이터의 제약을 우회한다.

| 오버라이드 | 동작 | 왜 필요한가 (제약) |
| --- | --- | --- |
| `image()` | `RefererImage` 컴포넌트로 렌더 | SKKU 이미지 서버가 Referer 헤더를 요구 + dimension hint 기반 shimmer placeholder 표시 |
| `paragraph()` | 이미지 포함 paragraph → `<View>`, 텍스트만 → `<Text selectable>` 분기 | `Animated.View`(shimmer)가 `Text` 안에서 동작하지 않는 RN 제약 우회 — 이미지가 섞이면 View 계층으로 승격 |
| `link()` | 웹 링크 → in-app browser, 이메일/전화 → 클립보드 복사 | 공지 본문의 `mailto:`/`tel:` 류를 외부 앱 점프 없이 처리 |

## Image dimension hint (CLS 제거)

크롤러(skkuverse-crawler)가 이미지 원본 크기를 markdown alt text에 `![{WxH} alt](url)` 포맷으로 삽입한다. 앱의 `parseDimHint()`(`NoticeMarkdownView.tsx`)가 이를 파싱해:

1. hint가 있으면 → 이미지 로딩 **전에** 정확한 크기의 shimmer skeleton을 overlay로 표시 → CLS(Cumulative Layout Shift) 제거
2. hint가 없으면 → `Image.getSizeWithHeaders` 완료 후에야 표시 (Referer 헤더 포함 크기 조회)

## Notice row와 날짜 그루핑

**Row 구성** (`apps/mobile/src/features/notices/NoticeRow.tsx`):

- Toss-style 왼쪽 정렬 메타: `3일 전 · 학과명` — 학과명은 multi-dept 탭에서만 표시
- 첨부파일 있는 공지: 제목 옆 paperclip 아이콘
- 마감일 있는 공지: deadline badge (D-day 기반 색상 시스템)

**날짜 그루핑** — `groupNoticesByDate()` (`apps/mobile/src/features/notices/utils/groupNotices.ts`)가 공지를 5개 버킷으로 묶어 `SectionList` 헤더로 표시:

| 버킷 | 내용 | 정렬 |
| --- | --- | --- |
| `recent7` | 최근 7일 | 최상단 |
| `recent30` | 최근 30일 | |
| `month-{n}` | 올해 월별 | desc |
| `year-{n}` | 과거 연도별 | desc |
| `unknown` | 날짜 파싱 실패분 | 모든 year 버킷보다 뒤, default보다 앞 (priority 값은 `groupNotices.ts` 참조) |

`unknown`은 `item.date`가 빈 문자열·ISO timestamp·malformed 등 `YYYY-MM-DD` 파싱에 실패할 때의 fallback이다 — parser의 `asString(raw.date)`가 missing/null을 `''`로 강등하는 데 대한 방어. 라벨은 ko `기타` / en `Other` / zh `其他`.

## 온보딩 게이트와 자동복원

### 게이트 조건

공지 탭 진입 게이트는 `isAnonymous || !onboardingCompleted` (`apps/mobile/app/(tabs)/notices/index.tsx`). 둘 중 하나라도 true면 `OnboardingLanding`을 표시한다. 계정은 `@g.skku.edu` 도메인 필수.

### v2 게이트 화면 (2026-05-01 redesign)

좌상단 정렬 hook 헤드라인("성균관대 공지, / 찾지 말고 받아보세요", 32pt bold) + 가운데 mock 노티스 카드(복수전공 D-3 예시 — 한국어 하드코딩, i18n 미적용은 의도적 prototype 스코프) + 다크 그린 `#1f3d2e` CTA "시작하기" + 보조 "이미 가입한 적 있어요". CTA 색은 SDS Button variant에 없어 커스텀 Pressable 인라인.

게이트 활성 시 화면을 가입 유도에 집중시키기 위해 chrome을 숨기는데, 둘 다 **native 계층 특성상 overlay로 덮을 수 없어서 mount 자체를 막는 방식**이다:

| 숨김 대상 | 방법 | native 이유 |
| --- | --- | --- |
| 상단 탭 스트립 (헤더) | 게이트 분기에서 `<Stack.Screen options={{ headerShown: false }} />` 발화 (정상 분기는 `header: () => <NoticesHeader />`) | native-stack header는 body의 sibling이 아니라 **별도 계층에 mount**되므로 body 안 absolute overlay로 못 덮음 — header를 mount 안 하는 게 유일한 방법 |
| 하단 Search/Bookmarks/Filter 액세서리 바 | `showNoticesAccessory = isNoticesTab && !isAnonymous && onboardingCompleted` 게이트를 부모 `TabLayout`(`app/(tabs)/_layout.tsx`)에 hoist, `bottomAccessory={... ? () => <NoticesBottomAccessoryGate /> : undefined}` | 자식에서 `null` 리턴해도 **빈 Liquid Glass capsule이 공간을 차지**함 — prop 자체를 `undefined`로 만들어야 `setBottomAccessory:nil animated:YES`가 호출돼 진짜 unmount |

### 복원 경로 (dual-write)

- **메인 CTA**: 5-step Toss-style wizard로 push (`/onboarding`)
- **보조 액션 "이미 가입한 적 있어요"**: 인라인 Google Sign-In 핸들러 (`notices/index.tsx`의 `handleExistingAccountSignIn`) — `login.tsx` 패턴 미러 (pre-unregister anon device → sign-in → re-register). sign-in 후 `getPreferences(uid)` 명시 read → `prefs.onboardedAt != null && pickerSelections.dept.length > 0`이면 `useSettingsStore.restoreOnboardingFromRemote()` 즉시 호출 → 게이트 자동 해제 (flicker 없음). 신규 가입자거나 corrupt state면 `/onboarding`으로 push
- **Cold-start fallback**: `apps/mobile/src/hooks/useAppInit.ts`의 `onPreferencesChanged` 리스너가 동일한 자동복원 로직을 fallback으로 호출 — 이미 인증된 returning user의 평범한 부팅에서도 게이트 자동 해제. 인라인 핸들러와 **dual-write지만 race-free** (always-overwrite + 동일 데이터라 순서 무관)

### `onboardedAt` discriminator

Firestore `users/{uid}/preferences/main`의 명시 시그널. `seedOnboardingPreferences`(`apps/mobile/src/services/firestore-notifications.ts`)가 wizard 완료 시 `serverTimestamp()`로 시드하고, `initializeFirestoreNotifications`의 default doc은 `null`. Rules(`apps/mobile/firestore.rules`)가 'null→timestamp' **한 방향 immutability**를 강제한다 (시드 후 재변경 reject) — 테스트는 `apps/mobile/firestore.rules.test.mjs`.

### always-overwrite 의미론

`restoreOnboardingFromRemote`(`packages/shared/src/store/settings.ts`)는 idempotency guard가 **의도적으로 없다**. SSOT mirror = eventual consistency: account-switch(logout A → signin B) 케이스에서 A의 stale dept가 B의 값으로 자동 self-heal된다. dept 미러는 `pickerSelections.dept[0]`(primary) + `slice(1, 4)`(interest, 최대 3개).

### 'dept' 키 cross-cutting hard-code

discriminator 역할은 `onboardedAt`이 떠맡았지만, dept 미러 read는 여전히 3개 site에 하드코딩돼 있다. rename 시 **coordinated 변경 필수**:

| Site | 위치 |
| --- | --- |
| 인라인 sign-in 핸들러 | `apps/mobile/app/(tabs)/notices/index.tsx` |
| cold-start 리스너 | `apps/mobile/src/hooks/useAppInit.ts` |
| 서버 derive 계약 | `functions/src/notifications/tabsContract.ts` |

## 첨부파일

첨부파일은 `files.skkuverse.com` 프록시를 경유해 서빙되며, 공지 상세에서 preview/download 버튼을 제공한다 (`apps/mobile/src/features/notices/NoticeDetailScreen.tsx`).

## 관련 문서

- [deep-link.md](../reference/deep-link.md) — 공지 딥링크를 포함한 화이트리스트 계약
- [fcm-architecture.md](fcm-architecture.md) — preferences SSOT / 탭 구독 derive (공지 푸시의 서버 측)
- [2026-07 notices picker 유령 상태 포스트모템](../internal/2026-07-notices-picker-ghost-state.md) — 온보딩 시드 실패로 인한 유령 preferences 사례
