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

/**
 * User notification preferences (intent + derived).
 *
 * INTENT (client writable, sync target across devices):
 *   - enabled            : master toggle. OFF → no notifications regardless of categories.
 *   - categoryEnabled    : per-category on/off (essential / services / notices).
 *   - pickerSelections   : per picker tab key, the user-chosen ids that drive
 *                          the corresponding `prefix:id` topic subscriptions.
 *                          Currently active keys: dept, library, dorm, general.
 *
 * DERIVED (Cloud Function only — Firestore Rules block client writes):
 *   - subscribedTopics   : flat list of FCM topic strings actually used by
 *                          handle-notice CF for `array-contains-any` matching.
 *                          Computed by `deriveSubscribedTopics` in functions/.
 *   - derivedAt          : server timestamp of last derive run, for diagnostics.
 *
 * INVARIANT:
 *   subscribedTopics === deriveSubscribedTopics(enabled, categoryEnabled, pickerSelections)
 *
 * Mirror file: functions/src/types.ts (kept in sync manually).
 */
export interface PreferencesDocument {
  // Intent
  enabled: boolean;
  categoryEnabled: CategoryEnabled;
  pickerSelections: Record<string, string[]>;

  // Derived
  subscribedTopics: string[];
  derivedAt: unknown | null; // Firestore Timestamp; typed `unknown` here to avoid pulling Firestore SDK types into shared.
}

export interface CategoryEnabled {
  essential: boolean;
  services: boolean;
  notices: boolean;
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
