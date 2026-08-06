---
title: Mobile App (@skkuverse/mobile)
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# apps/mobile

> Expo 54 + React Native 0.81 모바일 앱 (iOS/Android). skkuverse의 메인 클라이언트.

## 실행

Expo Go는 사용하지 않는다 — 커스텀 네이티브 모듈(Firebase, Naver Maps) 때문에 항상 네이티브 빌드(CNG).

```bash
yarn start            # Expo dev server
yarn ios              # 타입체크 후 iOS 네이티브 빌드 실행
yarn android          # 타입체크 후 Android 네이티브 빌드 실행
npx tsc --noEmit      # 타입체크만 (별도 typecheck 스크립트 없음)
yarn lint             # expo lint (ESLint)
```

네이티브에 영향을 주는 변경(패키지 추가/삭제, `app.config.ts` plugins 등) 후에는 `npx expo prebuild --clean` 후 재실행.

## 구조

- `app/` — Expo Router 파일 기반 라우팅 (`(tabs)/`에 4탭: home/campus/transit/notices)
- `src/features/` — 기능 모듈 (home, bus, map, building, search, notices, …)
- `src/sdui/` — Server-Driven UI 위젯
- `firestore.rules` + `firestore.rules.test.mjs` — Firestore 보안 규칙 + 테스트 (루트에서 `yarn test:rules`)
- `scripts/` — 로컬 빌드/배포/OTA 스크립트

## 빌드·배포·OTA

로컬 EAS Build + Fastlane. 런북:

- [docs/how-to/ios-build-deploy.md](../../docs/how-to/ios-build-deploy.md)
- [docs/how-to/android-build-deploy.md](../../docs/how-to/android-build-deploy.md)
- [docs/how-to/ota-update.md](../../docs/how-to/ota-update.md)

## 더 읽기

아키텍처·패턴·네이티브 주의사항: 루트 [CLAUDE.md](../../CLAUDE.md) + [docs/](../../docs/README.md)
