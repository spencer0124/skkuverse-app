---
title: Webview App (@skkuverse/webview)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# apps/webview

> React 19 + Vite SPA — 모바일 앱에 webview로 임베드되는 보조 화면들 (지도, 버스, 분실물).

## 실행

```bash
yarn dev              # Vite dev server
yarn build            # tsc + vite build
yarn preview          # 빌드 결과 프리뷰
```

## 구조

- Hash 기반 라우팅 (React Router)
- 페이지: `hsscmap/`, `nscmap/` (Naver Maps), `bus/`, `lostandfound/`, `error`
- 네이티브 통신: [`@skkuverse/bridge`](../../packages/bridge/README.md) (`postToApp`, `parseWebMessage`)
- 스타일: Tailwind CSS — 커스텀 컬러 `deep-green: #1A8A5C`, 폰트 `WantedSans`

## 더 읽기

[docs/](../../docs/README.md) — 문서 인덱스
