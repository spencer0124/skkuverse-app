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

export interface PreferencesDocument {
  enabled: boolean;
  subscribedTopics: string[];
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
 * topics: Firestore `array-contains-any` 실제 한도는 30 (OR-query 도입 후)이지만,
 * MVP 는 보수적으로 ≤10 으로 guard. 백엔드가 split 해서 보낸다는 가정.
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
  deptId?: string;
  articleNo?: string;
  category?: string;
}

/** Dispatcher input; union expands as new types are added. */
export type NotificationRequest = NoticeNotificationPayload;
// future: | BusArrivalNotificationPayload | DormNotificationPayload
