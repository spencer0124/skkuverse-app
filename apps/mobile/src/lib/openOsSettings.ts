import notifee from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import { logHandledError } from '@/services/crashlytics';

/**
 * Open the OS app-settings screen with notification context.
 *
 * iOS: notifee.openNotificationSettings()는 iOS에서 documented JS-level no-op
 *      (`@notifee/react-native/src/types/Module.ts:385`: "On iOS, this is a
 *      no-op & instantly resolves."). 네이티브 측에 RCT_EXPORT_METHOD 자체가
 *      없어서 throw 없이 즉시 Promise.resolve()됨. 그래서 RN
 *      Linking.openSettings()(UIApplicationOpenSettingsURLString)를 직접 호출.
 *      RCTLinkingManager.mm의 openURL fail 시 reject하므로 catch로 잡힘.
 *      iOS는 앱 root Settings 페이지로 lands (notifications sub-page까지는 Apple
 *      이 안 보냄 — 시스템 정책).
 * Android: notifee가 ACTION_APP_NOTIFICATION_SETTINGS로 per-app 알림 페이지에
 *      바로 lands (Linking.openSettings()는 generic App Info → 한 탭 추가).
 *      notifee throw 시(older Android / OEM quirk) Linking으로 fallback.
 */
export async function openOsSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await Linking.openSettings();
    } catch (e) {
      logHandledError('openOsSettings/ios-linking', e);
    }
    return;
  }
  try {
    await notifee.openNotificationSettings();
    return;
  } catch (e) {
    logHandledError('openOsSettings/android-notifee', e);
  }
  try {
    await Linking.openSettings();
  } catch (e) {
    logHandledError('openOsSettings/android-linking', e);
  }
}
