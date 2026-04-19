/**
 * Firestore document shapes for the push notification subsystem.
 *
 * Collections:
 *   users/{uid}                  → UserDocument
 *   users/{uid}/preferences/main → PreferencesDocument
 *   devices/{deviceId}           → DeviceDocument
 *
 * Option D (no in-app inbox) — there is intentionally no NotificationDocument.
 * App-surface notifications are fire-and-forget; unread visibility is tracked
 * via a local Zustand counter (unreadCount) and OS badge, not Firestore.
 *
 * locale is modeled as 'ko' | 'en' even though AppLanguage includes 'zh',
 * because the server's locale-aware notification copy only supports ko/en.
 * 'zh' app users fall back to 'ko' at the useAppInit boundary.
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
