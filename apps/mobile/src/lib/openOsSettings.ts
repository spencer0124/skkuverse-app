import notifee from '@notifee/react-native';
import { Linking } from 'react-native';
import { logHandledError } from '@/services/crashlytics';

/**
 * Open the OS app-settings screen with notification context.
 *
 * notifee handles platform routing internally:
 *   - iOS:        UIApplication.openSettingsURLString  (= app-settings:)
 *   - Android 8+: ACTION_APP_NOTIFICATION_SETTINGS — drops directly into the
 *                 app's notifications page (vs Linking.openSettings() which
 *                 lands on the generic "App info" page with one extra tap)
 *   - Android <8: ACTION_APPLICATION_DETAILS_SETTINGS fallback
 *
 * Fail mode: notifee가 silent throw하던 케이스(TestFlight 'denied' 상태에서
 * 사용자가 CTA 눌러도 OS 설정이 안 열리던 증상) 대응으로 RN Linking을 두 번째
 * 시도로 둔다. iOS는 둘 다 결국 같은 openSettingsURLString을 호출하지만 JS
 * bridge 경로가 달라 한쪽이 fail하는 경우를 커버. 실패는 production에서도
 * Crashlytics로 보고하여 진짜 fail mode 파악 가능.
 */
export async function openOsSettings(): Promise<void> {
  try {
    await notifee.openNotificationSettings();
    return;
  } catch (e) {
    logHandledError('openOsSettings/notifee', e);
  }
  try {
    await Linking.openSettings();
  } catch (e) {
    logHandledError('openOsSettings/linking', e);
  }
}
