import notifee from '@notifee/react-native';

/**
 * Open the OS app-settings screen with notification context.
 *
 * notifee handles platform routing internally:
 *   - iOS:        UIApplication.openSettingsURLString  (= app-settings:)
 *   - Android 8+: ACTION_APP_NOTIFICATION_SETTINGS — drops directly into the
 *                 app's notifications page (vs Linking.openSettings() which
 *                 lands on the generic "App info" page with one extra tap)
 *   - Android <8: ACTION_APPLICATION_DETAILS_SETTINGS fallback
 */
export async function openOsSettings(): Promise<void> {
  try {
    await notifee.openNotificationSettings();
  } catch (e) {
    if (__DEV__) console.warn('[lib] openOsSettings failed:', e);
  }
}
