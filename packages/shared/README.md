---
title: Shared Package (@skkuverse/shared)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# packages/shared

> 데이터 레이어 공유 패키지 — API 클라이언트, Zustand 스토어, React Query 훅, 타입, 디자인 토큰, i18n.

## 테스트

```bash
yarn test             # vitest run
yarn test:watch
```

## 구조

- `api/` — Axios 클라이언트 (auth interceptor + retry, `Result<T>` success/failure union)
- `app/` — 스토어: `useAuthStore`, `useSettingsStore` (campus/language/lastTab), `useMapLayerStore`
- `hooks/` — React Query 훅: `useCampusSections`, `useTransitList`, `useBusConfig`, `useMapConfig`, `useBuildings`, …
- `notices/`, `bus/`, `building/`, `map/`, `sdui/`, `miniapps/` — 도메인별 로직/타입
- `tokens/` — 디자인 토큰 (colors, typography, spacing, radius, shadows) — SDS가 소비
- `i18n/` — `useT()` 훅, `SUPPORTED_LANGUAGES`

## 원칙

유저 데이터는 Firebase (Firestore/Auth), 공공 데이터(공지·건물·버스)는 백엔드 API(MongoDB) 경유 — [CLAUDE.md](../../CLAUDE.md) Data storage 원칙 참조.
