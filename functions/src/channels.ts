/**
 * Android Notification Channel ID mapping.
 *
 * SYNC: mirror of apps/mobile/src/services/notification-channels.ts
 * Channel IDs MUST be string-identical to what the app pre-registers via
 * notifee.createChannel(). Mismatch → Android silently falls back to
 * the default channel (lose per-channel importance + user can't tune).
 *
 * If the app-side switch/IDs change, update here too.
 */

/**
 * Channel by MESSAGE TYPE, which has to come before the category lookup because
 * a mini-app payload carries no `category` at all — a category-only mapping
 * would file every mini-app notification under notice_general.
 *
 * This is the OS-displayed half. `resolveNotificationChannel` in
 * apps/mobile/src/services/notification-channels.ts is the same decision for the
 * banner the app draws itself in the foreground, and the two must agree: if they
 * disagree, one notification appears under two different user-facing channels
 * depending on app state, and muting one silences half of them.
 */
export function mapTypeToChannel(type: string, category?: string): string {
  if (type === 'miniapp') return 'miniapp_general';
  return mapCategoryToChannel(category);
}

export function mapCategoryToChannel(category?: string): string {
  switch (category) {
    case 'academic':
      return 'notice_academic';
    case 'scholarship':
      return 'notice_scholarship';
    case 'career':
    case 'recruitment':
      return 'notice_career';
    case 'essential':
      return 'notice_essential';
    case 'services':
      return 'notice_services';
    default:
      return 'notice_general';
  }
}
