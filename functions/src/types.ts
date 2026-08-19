/**
 * Types redeclared here instead of importing from @skkuverse/shared.
 *
 * packages/shared/src/index.ts re-exports Zustand + react-native-mmkv stores,
 * which fail in Node runtime. packages/shared/src/types/notifications.ts
 * itself is pure-TS safe, but importing a monorepo subpath would require
 * wiring functions/ into yarn workspaces — abandoned to keep CF build
 * infra isolated from RN dep graph.
 *
 * SYNC CHANGE: if any field name / shape changes in
 *   packages/shared/src/types/notifications.ts
 * mirror it here.
 */

export interface UserDocument {
  locale: 'ko' | 'en';
}

/**
 * Mirror of packages/shared/src/types/notifications.ts PreferencesDocument.
 * See that file for the canonical doc + invariant.
 */
export interface CategoryEnabled {
  essential: boolean;
  services: boolean;
  notices: boolean;
}

export interface PreferencesDocument {
  // Intent (client writable)
  enabled: boolean;
  categoryEnabled: CategoryEnabled;
  /**
   * Per-notice-tab override. Undefined key → ON (default-on for forward
   * compatibility). Only consulted when categoryEnabled.notices is true.
   */
  noticeTabEnabled: Record<string, boolean>;
  pickerSelections: Record<string, string[]>;
  /**
   * Subscribed mini-app ids → one `miniapp:<id>` topic each. Client-writable
   * intent, written a single id at a time with arrayUnion/arrayRemove.
   * Optional: documents predating the field simply lack the key, so derive must
   * treat `undefined` as an empty list rather than assuming its presence.
   */
  miniAppSelections?: string[];

  /**
   * Server timestamp at first onboarding completion. Client-writable on
   * "null → timestamp" transition only (Rules enforce immutability after).
   * See canonical doc in shared/types/notifications.ts.
   */
  onboardedAt: FirebaseFirestore.Timestamp | null;

  // Derived (CF only — Rules block client write)
  subscribedTopics: string[];
  derivedAt: FirebaseFirestore.Timestamp | null;
}

export interface DeviceDocument {
  uid: string;
  token: string;
  platform: 'ios' | 'android';
  appVersion: string;
  lastActive: Date;
  active: boolean;
  subscribedTopics: string[];
  notificationsEnabled: boolean;
  locale: 'ko' | 'en';
}

/**
 * Request payload from crawler/backend to `sendNotification` CF.
 *
 * topics: Firestore `array-contains-any` 실제 한도인 30 으로 guard (`MAX_TOPICS`).
 * **백엔드는 split 하지 않는다** — 한 글이 여러 게시판에 교차 게시되면 서버가
 * 형제 문서의 topic 을 union 해서 **1회만** 보낸다 (skkuverse-server#75, 그쪽
 * ADR 0005). split 이 곧 중복 알림의 원인이었다: handler 는 topics 전체로
 * `array-contains-any` 단일 쿼리를 돌리므로 여러 topic 을 구독한 기기도 1번만
 * 반환되지만, 호출을 N번으로 쪼개면 그 기기가 N번 푸시를 받는다.
 * 이 한도는 skkuverse-server `notices.topics.ts` 의 `TOPIC_CAP` 과 항상 같아야 한다.
 *
 * title_en/body_en 은 ko-only MVP 구간에서 null 허용 — handler 가 ?? fallback
 * 으로 ko 문구를 선택. 번역 파이프라인 붙이면 자동으로 en 문구 우선.
 */
export interface NoticeNotificationPayload {
  type: 'notice';
  noticeId: string;
  topics: string[];
  title_ko: string;
  body_ko: string;
  title_en?: string | null;
  body_en?: string | null;
  sourceId?: string;
  articleNo?: string;
  category?: string;
}

/**
 * Request payload for a mini-app notification.
 *
 * Settled contract: docs/reference/miniapp-notification-payload.md. Read it before
 * changing a field, because the app half and this half ship on different release
 * paths — the server redeploys during an event, the code reading this on a phone
 * does not.
 *
 * No `topics` field, deliberately, and unlike NoticeNotificationPayload. A notice
 * caller passes topics because the crawler already knows which boards a notice was
 * posted to. A mini-app caller must not, because it is the thing being constrained:
 * the handler forces `miniapp:<miniAppId>` from the authenticated caller, which is
 * what closes the "any key targets any topic" gap named in ADR 0006.
 *
 * notificationId is required so that "the feed and the delivery cannot diverge" is
 * checkable after the fact rather than merely intended. The send path writes the
 * feed entry, then calls here with its id.
 *
 * actionType/actionValue are the SDUI action union, not a notification-only scheme.
 * An older app maps an unrecognised actionType to the `unknown` sentinel and does
 * nothing with it, so a payload written for a newer build degrades to a no-op.
 * Omit both to fall back to opening the mini app itself.
 */
export interface MiniAppNotificationPayload {
  type: 'miniapp';
  miniAppId: string;
  notificationId: string;
  title_ko: string;
  body_ko: string;
  title_en?: string | null;
  body_en?: string | null;
  actionType?: 'webview' | 'external' | 'route' | 'miniapp';
  actionValue?: string;
}

/**
 * Data-only push that invalidates the cached event-map manifest on the device.
 *
 * The emergency-correction lever: worst-case propagation drops from one poll
 * interval to roughly zero. It carries NO `notification` block — adding one draws a
 * banner for something the user was never meant to see — and on APNs it needs
 * `apns-push-type: background` with `apns-priority: 5`. Apple rejects a background
 * push sent at priority 10, and the rejection is per-message, so that mistake
 * disables the whole lever rather than degrading it.
 *
 * Scoped to `miniapp:<miniAppId>` like every other mini-app message. A broadcast to
 * all devices would reach people who never subscribed, and would be exactly the
 * privilege escalation the forced-topic rule exists to prevent. Non-subscribers
 * still converge on the next ordinary poll.
 */
export interface EventMapRefreshPayload {
  type: 'eventmap-refresh';
  miniAppId: string;
  /** Logged, never displayed. */
  reason?: string;
}

/** Dispatcher input; union expands as new types are added. */
export type NotificationRequest =
  | NoticeNotificationPayload
  | MiniAppNotificationPayload
  | EventMapRefreshPayload;
// future: | BusArrivalNotificationPayload | DormNotificationPayload
