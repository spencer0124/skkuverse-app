import { Platform } from 'react-native';
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

/**
 * Centralized FCM messaging service — thin wrapper around @react-native-firebase/messaging.
 *
 * Follows the same pattern as analytics.ts / crashlytics.ts:
 * - Never throws (all errors silently caught or logged in __DEV__)
 * - Stateless — stores are managed by the caller
 *
 * Key constraint: `messaging_ios_auto_register_for_remote_messages` is false
 * in firebase.json, so `ensureRegistered()` MUST be called before `getDeviceToken()`.
 *
 * Correct initialization order:
 *   requestPermission() → ensureRegistered() → getDeviceToken()
 *   + onTokenRefresh() as safety net
 */

type AuthorizationStatus = 'notDetermined' | 'authorized' | 'denied' | 'provisional';

function mapAuthStatus(status: FirebaseMessagingTypes.AuthorizationStatus): AuthorizationStatus {
  switch (status) {
    case messaging.AuthorizationStatus.AUTHORIZED:
      return 'authorized';
    case messaging.AuthorizationStatus.PROVISIONAL:
      return 'provisional';
    case messaging.AuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'notDetermined';
  }
}

// ── iOS Remote Registration ──────────────────────────────────────

/**
 * iOS only: Register for remote messages.
 * Required because `messaging_ios_auto_register_for_remote_messages` is false.
 * Must be called AFTER requestPermission() returns authorized/provisional.
 *
 * Safe to call multiple times — skips if already registered.
 */
export async function ensureRegistered(): Promise<void> {
  if (Platform.OS === 'ios' && !messaging().isDeviceRegisteredForRemoteMessages) {
    try {
      await messaging().registerDeviceForRemoteMessages();
    } catch (e) {
      if (__DEV__) console.warn('[fcm] registerDeviceForRemoteMessages failed:', e);
    }
  }
}

// ── Permission ───────────────────────────────────────────────────

/**
 * Check current permission status WITHOUT triggering the OS prompt.
 * Use for UI display (e.g., notification settings screen).
 */
export async function checkPermission(): Promise<AuthorizationStatus> {
  try {
    const status = await messaging().hasPermission();
    return mapAuthStatus(status);
  } catch (e) {
    if (__DEV__) console.warn('[fcm] hasPermission failed:', e);
    return 'notDetermined';
  }
}

/**
 * Request notification permission.
 *
 * IMPORTANT: On iOS, this is IDEMPOTENT — if permission is already granted,
 * it does NOT show the OS dialog and simply returns the current status.
 * This makes it safe to call on every app launch as the primary permission check.
 *
 * On Android 13+, this triggers the POST_NOTIFICATIONS permission dialog.
 */
export async function requestPermission(): Promise<AuthorizationStatus> {
  try {
    const status = await messaging().requestPermission();
    return mapAuthStatus(status);
  } catch (e) {
    if (__DEV__) console.warn('[fcm] requestPermission failed:', e);
    return 'denied';
  }
}

// ── Token ────────────────────────────────────────────────────────

/**
 * Wait for APNs token to arrive (iOS only).
 * registerDeviceForRemoteMessages() resolves immediately, but the actual
 * APNs token arrives asynchronously via didRegisterForRemoteNotificationsWithDeviceToken.
 * This can take 100ms-2s on first registration.
 */
async function waitForAPNsToken(timeoutMs: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const token = await messaging().getAPNSToken();
      if (token) return token;
    } catch {
      // ignore — keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (__DEV__) console.warn('[fcm] APNs token not received within', timeoutMs, 'ms');
  return null;
}

/**
 * Get the FCM registration token for this device.
 * On iOS, waits for APNs token to arrive first (up to 5 seconds).
 * Requires ensureRegistered() to have been called first on iOS.
 */
export async function getDeviceToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      const apnsToken = await waitForAPNsToken(5000);
      if (!apnsToken) {
        if (__DEV__) console.warn('[fcm] getDeviceToken: APNs token unavailable, skipping FCM token');
        return null;
      }
    }
    return await messaging().getToken();
  } catch (e) {
    if (__DEV__) console.warn('[fcm] getToken failed:', e);
    return null;
  }
}

/**
 * Subscribe to FCM token refresh events.
 * Acts as a safety net — if getDeviceToken() fails due to APNs timing,
 * onTokenRefresh will fire when the token eventually becomes available.
 * Returns an unsubscribe function.
 */
export function onTokenRefresh(callback: (token: string) => void): () => void {
  return messaging().onTokenRefresh(callback);
}

// ── Message Listeners ────────────────────────────────────────────

/**
 * Subscribe to foreground messages (app is open and visible).
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  callback: (message: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  return messaging().onMessage(callback);
}

// ── Notification Tap Handlers ────────────────────────────────────

/**
 * Get the notification that launched the app from quit state.
 * Returns null if app was not opened via a notification tap.
 */
export async function getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
  try {
    return await messaging().getInitialNotification();
  } catch (e) {
    if (__DEV__) console.warn('[fcm] getInitialNotification failed:', e);
    return null;
  }
}

/**
 * Subscribe to notification taps when the app is in background state.
 * Returns an unsubscribe function.
 */
export function onNotificationOpenedApp(
  callback: (message: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  return messaging().onNotificationOpenedApp(callback);
}
