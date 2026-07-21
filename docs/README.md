---
title: Docs Index & Conventions
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# Docs Index & Conventions

> skkuverse-app 문서의 인덱스이자 문서 작성 규칙의 단일 진실 출처(SSOT). 새 문서를 쓰기 전에 이 파일을 읽는다.

## 폴더 구조 (Diátaxis)

문서는 [Diátaxis](https://diataxis.fr/) 4분류 + 내부 전용 3분류로 나눈다. **분류 기준은 주제가 아니라 독자의 니즈**다.

| 폴더 | 니즈 | 내용 | 예시 |
| --- | --- | --- | --- |
| `tutorials/` | 배우기 (학습) | 손잡고 따라가는 온보딩 레슨 | (아직 없음 — 자리만 예약) |
| `how-to/` | 해내기 (작업) | 특정 목표를 달성하는 절차 런북 | 빌드·배포, OTA 발행 |
| `reference/` | 찾아보기 (정보) | 계약·스펙·규칙의 권위 있는 사실 | API 스펙, 딥링크 계약, UX 라이팅 규칙 |
| `explanation/` | 이해하기 (맥락) | 왜 이렇게 되어 있는지, 네이티브 메커니즘 | iOS 26 탭바, SafeArea, 마커 버그 |
| `decisions/` | — | ADR (Architecture Decision Records) | `NNNN-kebab-title.md` |
| `internal/` | — | 포스트모템, 디버깅 기록 | `YYYY-MM-topic.md` |
| `plans/` | — | 진행 중/완료된 구현 계획 (mutable, 초안 성격) | FCM 푸시 계획 |

**한 문서 = 한 니즈.** 절차와 배경 설명이 섞이면 문서를 쪼개고 서로 링크한다.

패키지 국소 지식(해당 패키지에서만 유효한 내용)은 이 폴더가 아니라 **각 워크스페이스의 `README.md`** 또는 패키지 내 문서(`packages/sds/SDS.md` 등)에 둔다. 여기는 패키지 경계를 넘는(cross-cutting) 지식 전용.

## 문서 인덱스

### how-to (런북)

| 문서 | 요약 |
| --- | --- |
| [ios-build-deploy.md](how-to/ios-build-deploy.md) | iOS 로컬 빌드(EAS `--local`) → TestFlight/App Store 배포 |
| [android-build-deploy.md](how-to/android-build-deploy.md) | Android 로컬 빌드 → Google Play 배포 |
| [ota-update.md](how-to/ota-update.md) | OTA 업데이트 발행 (beta/production 채널) |

### reference (계약·스펙)

| 문서 | 요약 |
| --- | --- |
| [deep-link.md](reference/deep-link.md) | `skkuverse://` + 유니버셜 링크 화이트리스트 계약 |
| [map-config-api-spec.md](reference/map-config-api-spec.md) | `GET /map/config` 등 지도 API 계약 (server↔client) |
| [sdui-campus-spec.md](reference/sdui-campus-spec.md) | Campus 탭 Server-Driven UI 계약 |
| [ux-writing.md](reference/ux-writing.md) | UX 라이팅 규칙 (해요체 등 6대 규칙 + 8원칙) |

### explanation (메커니즘·배경)

| 문서 | 요약 |
| --- | --- |
| [ios-26-native-tabs-minimize.md](explanation/ios-26-native-tabs-minimize.md) | NativeTabs minimize + contentInset의 chain root rule |
| [ios-modal-safe-area-provider.md](explanation/ios-modal-safe-area-provider.md) | 모달 라우트별 SafeAreaProvider 재마운트가 필요한 이유 |
| [android-naver-map-markers.md](explanation/android-naver-map-markers.md) | 커스텀 뷰 마커 bitmap snapshot race와 해법 |
| [splash-animation.md](explanation/splash-animation.md) | 스플래시 애니메이션 구현과 InitGate 연동 |

### decisions (ADR)

| 문서 | 상태 |
| --- | --- |
| [0001-adopt-diataxis-docs-structure.md](decisions/0001-adopt-diataxis-docs-structure.md) | accepted |

### internal (포스트모템·디버깅)

| 문서 | 요약 |
| --- | --- |
| [2026-07-notices-picker-ghost-state.md](internal/2026-07-notices-picker-ghost-state.md) | 학과 picker 유령 preferences 상태 포스트모템 |

### plans (구현 계획)

| 문서 | 상태 |
| --- | --- |
| [fcm-push-notifications.md](plans/fcm-push-notifications.md) | superseded — 완료. 현행 SSOT는 `CLAUDE.md` FCM 섹션 |

## 문서 작성 규칙

### 1. Frontmatter (필수)

모든 문서는 YAML frontmatter로 시작한다:

```yaml
---
title: <Title Case 제목>
type: how-to | reference | explanation | tutorial | adr | plan | postmortem
status: draft | accepted | superseded | deprecated
owner: zoyoong124@gmail.com
last-updated: YYYY-MM-DD
audience: internal | public
---
```

- `status: superseded/deprecated`일 때는 본문 첫머리에 현행 SSOT 링크를 남긴다.
- 문서 내용을 실질적으로 고칠 때마다 `last-updated`를 갱신한다.

### 2. 골격

frontmatter 다음은 반드시:

1. `# H1` — 문서당 정확히 하나
2. `> 한 줄 요약` — 이 문서가 무엇이고 누가 읽어야 하는지

이후 `##` 섹션. 레벨 건너뛰기 금지. 새 문서는 [`_template.md`](_template.md)를 복사해서 시작한다.

### 3. 값을 복사하지 말고 출처를 가리켜라

**버전·수치·개수를 문서에 하드코딩하지 않는다.** 코드가 바뀌면 문서가 조용히 거짓말을 시작하는 것이 이 레포 staleness의 근본 원인이었다 (OTA 문서의 `runtimeVersion` 박제, rules 테스트 개수 박제 등).

- ❌ `runtimeVersion은 3.5.0이다`
- ✅ `runtimeVersion은 apps/mobile/app.config.ts에서 확인한다`
- 예시 값이 꼭 필요하면 `<runtime-version>` 플레이스홀더나 "작성 시점 기준" 명시를 쓴다.

### 4. 파일명

- **kebab-case, 소문자, `.md`** — `ios-build-deploy.md`
- ADR: `NNNN-kebab-title.md` (0패딩 일련번호, 동사 시작 권장) — `0001-adopt-diataxis-docs-structure.md`
- 포스트모템: `YYYY-MM-topic.md` — `2026-07-notices-picker-ghost-state.md`
- ALL-CAPS는 GitHub 특수 파일만 (`README`, `CONTRIBUTING`, `LICENSE`)

### 5. 서식

- 코드펜스는 **언어 태그 필수** (`bash`, `ts`, `tsx`, `json`, `yaml` — `typescript` 말고 `ts`)
- 구조화된 사실(파라미터, 경로, 옵션)은 표로
- 주의·경고는 GitHub admonition: `> [!NOTE]`, `> [!WARNING]`
- 본문 언어는 한국어, 기술 용어는 영어 그대로
- 린트: `yarn lint:md` (markdownlint-cli2, 설정은 루트 `.markdownlint-cli2.jsonc`)

### 6. 라이프사이클

- 계획(`plans/`)이 구현 완료되면: 정착한 지식은 `reference/`/`explanation/`으로 옮기거나 새로 쓰고, 계획 문서는 `status: superseded`로 표시 (삭제하지 않음 — 이력 가치)
- 구조적 결정을 내렸으면 `decisions/`에 ADR 한 편 (Context / Decision / Consequences)
- 문서가 코드와 어긋난 걸 발견하면 그 자리에서 고치거나, 최소한 `> [!WARNING] stale` 표시를 남긴다
