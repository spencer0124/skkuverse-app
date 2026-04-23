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
export function mapCategoryToChannel(category?: string): string {
  switch (category) {
    case 'academic':
      return 'notice_academic';
    case 'scholarship':
      return 'notice_scholarship';
    case 'career':
    case 'recruitment':
      return 'notice_career';
    default:
      return 'notice_general';
  }
}
