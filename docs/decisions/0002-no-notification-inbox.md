---
title: No Notification Inbox (Option D)
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# 0002. 알림함(inbox) 없는 푸시 설계 (옵션 D)

## Status

Accepted — 2026-04 (FCM 푸시 설계 시 결정, 2026-07-21 백필 기록)

## Context

FCM 푸시 알림을 설계하면서 "지난 알림을 앱 안에서 다시 볼 수 있는 알림함"을 만들 것인지 선택해야 했다. 알림함을 만들면:

- 알림 기록을 저장할 서버 저장소(유저별 알림 컬렉션)가 필요하고,
- 읽음/안읽음 상태 동기화, 보관 기간·정리 정책 등 부수 복잡도가 따라온다.

한편 이 앱의 푸시는 대부분 **공지사항 알림**이고, 공지 원문은 이미 notices 탭에 서버 데이터로 존재한다 — 알림함이 없어도 유저가 내용 자체에 접근할 경로가 있다.

## Decision

**알림함을 만들지 않는다 (옵션 D).**

- 알림 기록을 서버·클라이언트 어디에도 저장하지 않는다.
- 앱 아이콘 뱃지(unread count)는 **Zustand + Notifee 로컬**로만 관리한다 — 서버 왕복 없음.
- 딥링크로 알림 탭 시 해당 공지로 직행하고, 그걸로 알림의 수명은 끝난다.

## Consequences

- (+) 유저별 알림 저장소, 읽음처리 동기화, 보관 정책 등 서버·클라 복잡도가 통째로 제거된다.
- (+) 뱃지가 device-local state라 Firestore 왕복 없이 즉시 반응한다.
- (−) 시스템 알림 센터에서 지워진 알림은 다시 볼 수 없다. **공지 자체는 notices 탭에 남아 있으므로 수용** — 재열람 니즈는 공지 리스트가 흡수한다.
- (−) 공지가 아닌 알림(예: 미래의 일회성 안내)은 놓치면 복구 경로가 없다 — 그런 유형이 늘어나면 이 결정을 재검토한다.

관련: `CLAUDE.md` FCM 섹션, `docs/plans/fcm-push-notifications.md` (superseded plan).
