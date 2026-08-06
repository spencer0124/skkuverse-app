---
title: Adopt Diátaxis Docs Structure
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# 0001. Diátaxis 기반 문서 구조 채택

## Status

Accepted — 2026-07-21

## Context

`docs/`에 11개 문서가 평면으로 쌓이며 세 가지 문제가 겹쳤다:

1. **Staleness** — 문서가 코드에서 값을 복사해 박제 (OTA `runtimeVersion` 3.5.0 박제, rules 테스트 개수 26/30 박제 등 감사에서 9건 확인). 코드가 바뀌어도 문서는 조용히 낡는다.
2. **분류 부재** — 런북·네이티브 노트·API 계약·포스트모템·진행 중 계획이 한 폴더에 섞여, 정착한 스펙과 초안을 구분할 수 없음.
3. **형식 부재** — frontmatter/상태/갱신일 메타데이터 없음. `docs/internal/`의 포스트모템 한 편만 구조화되어 있었음.

## Decision

- **[Diátaxis](https://diataxis.fr/) 4분류 폴더** (`tutorials/`·`how-to/`·`reference/`·`explanation/`) + 내부 전용 3폴더 (`decisions/`·`internal/`·`plans/`) 채택. 분류 축은 주제가 아니라 **독자의 니즈**.
- 모든 문서에 **frontmatter** (`title/type/status/owner/last-updated/audience`) + H1 하나 + 한 줄 요약 골격 강제.
- **값 복사 금지 규칙**: 버전·수치는 하드코딩하지 않고 source-of-truth 파일을 가리킨다.
- **워크스페이스별 `README.md`** 신설 — 패키지 국소 지식은 코드 옆에 co-locate, `docs/`는 cross-cutting 전용.
- **markdownlint-cli2**를 루트에 도입 (`yarn lint:md`), 규칙은 `.markdownlint-cli2.jsonc`. Prettier는 도입하지 않음 — 이 monorepo에 Prettier가 원래 없고, 새 포매터 도입은 스코프 초과라 lint `--fix`로 갈음.
- 파일명 kebab-case, ADR은 `NNNN-kebab-title.md` (MADR-lite: Context/Decision/Consequences).

전체 규칙의 SSOT는 [docs/README.md](../README.md).

## Consequences

- (+) 문서의 목적이 경로만으로 드러남. 초안(`plans/`, `status: draft`)과 권위 문서(`reference/`)가 물리적으로 구분됨.
- (+) staleness의 주범이던 값 박제가 컨벤션+린트로 차단됨. `last-updated`로 낡음이 가시화됨.
- (+) AI 에이전트가 frontmatter `type/status/audience`를 기계적으로 읽고 문서 신뢰도를 판단 가능.
- (−) 기존 `docs/*.md` 평면 경로를 참조하던 `CLAUDE.md`·`README.md`·소스 주석 전부 갱신 필요 (이 ADR과 같은 브랜치에서 일괄 수행).
- (−) 새 문서 작성 시 분류 판단 비용 발생 — 애매하면 [docs/README.md](../README.md)의 니즈 표 기준으로 판정.
- 문서 볼륨이 커지거나 공개 사이트가 필요해지면 VitePress 도입을 재검토 (현재는 보류).
