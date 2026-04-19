import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * Background message handler — registered at module scope in index.ts,
 * before AppRegistry.registerComponent (expo-router/entry).
 *
 * Phase 3 will add Notifee displayNotification here.
 */
export async function backgroundMessageHandler(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  if (__DEV__) {
    console.log('[fcm] background message:', remoteMessage.messageId);
  }
}
