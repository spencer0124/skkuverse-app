---
title: User Data in Firebase, Public Data in MongoDB
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# 0005. 유저 데이터 = Firebase, 공공 데이터 = MongoDB

## Status

Accepted — 데이터 아키텍처 초기 결정 (정확한 시점 기록 없음, 2026-07-21 백필 기록)

## Context

앱이 다루는 데이터는 성격이 둘로 갈린다:

- **유저 데이터** — 인증 상태, 알림 preferences, 디바이스 등록 등 유저별 소유·권한이 필요한 데이터.
- **공공 데이터** — 공지사항, 건물 정보, 버스 시간표 등 모든 유저에게 동일한 읽기 중심 데이터 (크롤러·백엔드가 생산).

이를 하나의 저장소로 통일할지, 아니면 클라이언트가 DB에 직접 붙는 경로와 API 경유 경로를 데이터 성격에 따라 나눌지 선택해야 했다.

## Decision

- **유저 데이터는 전부 Firebase** — Firebase Auth + Firestore에 클라이언트가 **직접** 읽고 쓴다 (예: `users/{uid}/preferences/main`, `devices/{deviceId}`). 서버 로직이 필요한 부분은 Cloud Functions 트리거로 파생.
- **공공 데이터는 전부 MongoDB** — 클라이언트는 DB에 직접 붙지 않고 **백엔드 API(skkuverse-server) 경유**로만 읽는다.

## Consequences

- (+) 유저 데이터는 Firestore의 오프라인 큐잉·실시간 listener를 공짜로 얻는다 (캠퍼스 wifi dead spot에서 preferences write가 큐잉되는 등).
- (+) 공공 데이터는 서버가 캐싱·가공·집계 계층 역할을 한다 — 크롤러 산출물을 클라이언트 계약(`GET /notices/tabs` 등)으로 변환하고, 스키마 변경을 서버에서 흡수.
- (−) **유저 데이터의 보안 경계는 오로지 Firestore Rules다.** 클라이언트가 DB에 직접 쓰므로 서버 미들웨어 검증 계층이 없다 — Rules가 뚫리면 끝. 따라서 Rules 변경은 반드시 `yarn test:rules`(emulator 기반 rules 테스트)와 함께 가며, derived 필드 client-write 봉쇄 같은 불변식을 테스트로 고정하는 규율이 필수.
- (−) 데이터가 두 저장소로 갈라져 있어, 둘을 잇는 지점(예: 서버가 공지를 FCM topic으로 발송 → Firestore devices 쿼리)에서는 크로스-레포 계약 미러가 생긴다 ([add-notice-tab 런북](../how-to/add-notice-tab.md) 참조).
- 판정 기준이 단순해서 신규 기능의 저장소 선택 고민이 없다: "유저별 소유·권한이 필요한가?" → Firebase, 아니면 MongoDB+API.
