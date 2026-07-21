# Postmortem: 학과 picker 저장 무반응 (유령 preferences 상태)

| | |
|---|---|
| **Date** | 발생 ~2026-04-25부터 누적 · 문의 2026-07 · 수정 2026-07-18 |
| **Status** | Resolved — fix merged (`3e3cbca`, dev), 배포 대기 |
| **Detection** | 사용자 문의 1건 (안드로이드 화면녹화). 모니터링 미감지 — Crashlytics에 90일간 라벨이 쌓여 있었으나 리뷰 부재 |
| **Trigger** | Play Integrity 스로틀(-8) 등으로 온보딩 Firestore 시드 write 실패 → catch가 무음 삼킴 |
| **Root Cause** | ① 로컬 완료 게이트를 서버 write보다 먼저 커밋 (유령 탄생) ② 자가복구 시드 `essential:false` ↔ rules ESSENTIAL LOCK 모순으로 복구 경로 사망 (영구화) |

## TL;DR

온보딩의 Firestore 시드가 조용히 실패하면 `preferences/main` 문서 없이 "온보딩 완료" 상태가 되고(유령), 이후 학과 picker의 `update()`는 매번 실패하며 화면은 fallback(건축학과)에 고정된다. 탈출구인 자가복구 create는 rules 위반(`essential:false`)으로 한 번도 성공한 적 없는 죽은 코드였다. 90일간 유령 25명, 증상 도달 7명. 수정: essential 정합 + write 성공 후에만 완료 게이트 + 권한 게이트 밖 self-heal(기존 유령 자동 복구).

## Impact (Android 3.5.1, 90일 Crashlytics)

| 지표 | 값 |
|---|---|
| 유령 탄생 (`onboarding/finalize` 실패) | **25명** / 97건 |
| 증상 도달 — picker 저장 실패 (`notifications/picker-set`) | **7명** / 32건 |
| 죽은 자가복구 충돌 (`notifications/init`+`register`+`post-signin`) | 78명 / 231건 |
| Play Integrity 스로틀 (`app-check-refresh` -8) | 82명 / 266건 |
| 지속 기간 | ~84일 (rules 강화 2026-04-25 → 수정 07-18) |
| 부수 피해 | prefs create throw → `registerDevice` 연쇄 실패 (푸시 기기 등록 누락) |

## Timeline

| 시각 | 이벤트 |
|---|---|
| 04-25 10:20 | 부트스트랩 기본 문서(`essential:false`) 작성 (`ecd4a7c`) |
| 04-25 13:55 | rules ESSENTIAL LOCK 추가 (`ded4a4b`) — 기존 기본값 미수정 → **자가복구 사망** |
| 04-25~07 | 유령 누적 (Crashlytics 라벨 축적, 미인지) |
| 07-18 | 사용자 문의 + 화면녹화 접수 → 진단 → 수정 커밋 `3e3cbca` push (dev) |
| — | 배포 후: permission-denied 계열 라벨 소멸 확인 예정 |

## Root Cause — 5 Whys

1. **왜 완료를 눌러도 반영이 안 되나?** → `preferences/main` 문서가 없어 `update()`(patch)가 매번 실패. rules 환경에선 permission-denied로 관측 (문서 부재를 위장하는 Firestore 동작).
2. **왜 문서가 없나?** → 온보딩 시드 write가 실패했는데 `completeOnboarding()`(MMKV)이 먼저 실행돼 "로컬 완료·서버 없음"으로 분기. catch는 로그만 남기고 진행.
3. **왜 시드가 실패했나?** → `primeAppCheck()`가 매 write마다 강제 토큰 갱신 → 온보딩(write 밀집)에서 Play Integrity 스로틀(-8) → 토큰 불가 순간의 write 거부.
4. **왜 자가복구가 못 살렸나?** → 복구 create가 `essential:false`인데 rules는 `essential==true` 요구. 규칙을 3.5시간 뒤에 조이며 기존 시드를 미수정한 regression. rules 테스트의 deny 픽스처가 프로덕션 시드와 동일 shape이었으나 아무도 연결 못 함.
5. **왜 84일간 몰랐나?** → 모든 실패가 non-fatal 라벨로만 기록되고 사용자 피드백 없음. 비치명적 오류 정기 리뷰 부재.

**증상 체인:** 문서 없음 → onSnapshot `null` → 스토어 defaults → `resolvePickerSelection` 최후 fallback `sources[0]` = ㄱㄴㄷ 첫 학과(건축학과) 고정 표시.

## Resolution

수정 커밋 `3e3cbca` (5파일, +215/−52 · tsc/lint/tests/rules 72/72 green):

| 구분 | 변경 |
|---|---|
| 근본 (P0) | 자가복구 시드 `essential: false → true` |
| 예방 (P1·P2) | `completeOnboarding()`을 Firestore write **성공 후**로 이동, 실패 시 Alert+재시도. 시드에 `withRetry`. 무음 스킵 2곳에 로그 |
| 예방 (P3) | `ensurePreferencesDoc` 분리 — prefs 실패와 기기 등록 디커플링. `finalizeOnboardingAccepted` 멱등화 |
| 복구 (S1·S2) | `onAuthStateChanged`에서 알림 권한과 무관하게 문서 보장 + MMKV에 남은 학과 선택 복원 → **기존 유령은 앱 업데이트 후 재실행 1회로 자동 복구** |
| 회귀 방지 (S4) | rules 테스트에 prod-mirror create→allow 가드 |

## What Went Well / Wrong

**Well**
- ACCEPT 경로엔 Alert+재시도 규율이 이미 있었음 → 실측 대조: 그 경로(`seed-intent`)는 29명 전원 1회 회복, 무음 경로(`finalize`)는 유령 25명. 수정은 이 규율의 복제
- 과거 디버깅 기록(`docs/plans/fcm-push-notifications.md`)의 latency-compensation 지식이 가설 절반을 즉시 기각

**Wrong**
- 로컬/서버 이중 기록이 비원자적 + 실패 무음 → 유령 상태 가능
- rules 강화 시 기존 클라이언트 payload 미점검 → 복구 경로 84일 사망
- 비치명적 라벨 수백 건이 쌓였으나 아무도 보지 않음

## Action Items

- [x] 수정 커밋 + dev push (`3e3cbca`) — 07-18
- [ ] **릴리스 배포** — 유령 자동 복구는 배포가 전제 (우선순위 최상)
- [x] **P5: `primeAppCheck` 스로틀 완화** (`78985ee`) — 5분 캐시 + `app-check-prime.ts` 단일 모듈 통합 (notifications/bookmarks/feedback 3중 사본 제거). Crashlytics 라벨 `app-check/refresh`로 통합
- [ ] 배포 후 Crashlytics 확인 — permission-denied 계열 소멸 + 신규 라벨(`ensure-prefs`, `complete-no-uid`) 미발생
- [ ] E2E: Android beta 프로파일(Play Integrity 실경로 — dev 빌드는 debug provider라 무효)로 DECLINE 온보딩 → picker 저장 검증
- [ ] 운영: 비치명적 오류 주간 리뷰 습관화
- [ ] (선택) S3: picker write 실패 시 사용자 피드백 / P4: 온보딩 중 선-create 스킵

## Appendix — 코드 색인

`firestore-notifications.ts`(DEFAULT_PREFS·ensurePreferencesDoc·시드/finalize) · `firestore.rules`(ESSENTIAL LOCK) · `firestore.rules.test.mjs`(prod-mirror 가드) · `OnboardingScreen.tsx`(handleComplete 순서 불변식) · `useAppInit.ts`(self-heal) · `packages/shared/notices/picker.ts`(fallback 사다리) · 진단 판별법: "잠깐 반영 후 revert"=서버 거부, "처음부터 무반응"+update=문서 부재, 타 컬렉션 write 정상=인증/App Check 기각.
