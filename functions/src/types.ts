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

/** Dispatcher input; union expands as new types are added. */
export type NotificationRequest = NoticeNotificationPayload;
// future: | BusArrivalNotificationPayload | DormNotificationPayload
