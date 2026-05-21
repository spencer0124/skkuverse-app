import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuth } from '@react-native-firebase/auth';
import { useNotificationStore, useSettingsStore } from '@skkuverse/shared';
import { ensureRegistered, getDeviceToken, requestPermission } from '@/services/messaging';
import { initializeFirestoreNotifications } from '@/services/firestore-notifications';
import { openOsSettings } from '@/lib/openOsSettings';
import { logHandledError } from '@/services/crashlytics';

interface UseEnableNotificationsFlowOptions {
  /**
   * Always called after the flow resolves — `dispatch(NEXT)` for the onboarding
   * step, `sheetRef.dismiss()` for the settings sheet. Wrapped in a ref so the
   * AppState listener doesn't re-attach when the caller passes an inline arrow.
   */
  onResolved: () => void;
  /**
   * Optional extra work after permission is granted (e.g. `setMasterEnabled(uid, true)`
   * for the settings sheet — onboarding does NOT need this because
   * `seedOnboardingPreferences` already writes `enabled: true` in step 6).
   */
  additionalOnGranted?: () => Promise<void> | void;
}

/**
 * Module-level token registration. Mirrors useAppInit's lazy-uid pattern so
 * writes land under the current uid. No hook state — safe to call from
 * fire-and-forget contexts (e.g. onboarding skip path when permission is
 * already granted and step 5's handleEnable won't run).
 */
export async function registerCurrentDeviceForNotifications(): Promise<void> {
  await ensureRegistered();
  const fcmToken = await getDeviceToken();
  if (!fcmToken) return;
  useNotificationStore.getState().setFcmToken(fcmToken);

  const deviceId = useNotificationStore.getState().deviceId;
  if (!deviceId) return;

  const uid = getAuth().currentUser?.uid;
  if (!uid) return;

  const appLang = useSettingsStore.getState().appLanguage;
  const osLocale: 'ko' | 'en' = appLang === 'ko' ? 'ko' : 'en';
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

  await initializeFirestoreNotifications({
    uid,
    deviceId,
    token: fcmToken,
    platform,
    appVersion,
    osLocale,
  });
  useNotificationStore.getState().setIsTokenRegistered(true);
}

/**
 * Shared "ask for notification permission" flow used by both the onboarding
 * Step 5 and the settings-screen enable sheet. Encapsulates:
 *
 *   1. Branching on persisted `permissionStatus`:
 *      - `'denied'` → open OS settings (iOS won't re-prompt; notifee on
 *        Android 8+ drops directly into the notifications page)
 *      - else → `requestPermission()` (idempotent on iOS)
 *   2. AppState `'active'` listener for settings-return: re-checks permission,
 *      registers token if granted, runs callbacks. `sentToSettingsRef` gates
 *      the listener so unrelated foreground transitions are no-ops.
 *   3. Token registration via `initializeFirestoreNotifications` mirroring
 *      useAppInit's lazy-uid pattern so writes land under the current uid.
 */
export function useEnableNotificationsFlow({
  onResolved,
  additionalOnGranted,
}: UseEnableNotificationsFlowOptions) {
  const sentToSettingsRef = useRef(false);

  const onResolvedRef = useRef(onResolved);
  const additionalOnGrantedRef = useRef(additionalOnGranted);
  useEffect(() => {
    onResolvedRef.current = onResolved;
    additionalOnGrantedRef.current = additionalOnGranted;
  });

  const runGrantedSideEffects = useCallback(async () => {
    try {
      await registerCurrentDeviceForNotifications();
    } catch (err) {
      logHandledError('notifications/register', err);
    }
    const extra = additionalOnGrantedRef.current;
    if (extra) {
      try {
        await extra();
      } catch (err) {
        logHandledError('notifications/additional-on-granted', err);
      }
    }
  }, []);

  const handleEnable = useCallback(async () => {
    const prior = useNotificationStore.getState().permissionStatus;
    if (prior === 'denied') {
      sentToSettingsRef.current = true;
      await openOsSettings();
      return; // AppState listener takes over after the user returns.
    }
    const status = await requestPermission();
    useNotificationStore.getState().setPermissionStatus(status);
    if (status === 'authorized' || status === 'provisional') {
      await runGrantedSideEffects();
    }
    onResolvedRef.current();
  }, [runGrantedSideEffects]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active' || !sentToSettingsRef.current) return;
      sentToSettingsRef.current = false;
      const status = await requestPermission();
      useNotificationStore.getState().setPermissionStatus(status);
      if (status === 'authorized' || status === 'provisional') {
        await runGrantedSideEffects();
      }
      onResolvedRef.current();
    });
    return () => sub.remove();
  }, [runGrantedSideEffects]);

  return { handleEnable };
}
