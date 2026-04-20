import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuth, signInAnonymously, onAuthStateChanged } from '@react-native-firebase/auth';
import { getLocales } from 'expo-localization';
import {
  setAuthTokenProvider,
  getApiClient,
  authStore,
  useSettingsStore,
  useNotificationStore,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  t as translate,
} from '@skkuverse/shared';
import type { AppLanguage } from '@skkuverse/shared';
import mobileAds from 'react-native-google-mobile-ads';
import { setCrashlyticsUserId, logHandledError } from '@/services/crashlytics';
import { configureGoogleSignIn } from '@/services/google-auth';
import {
  disableAnalyticsInDev,
  setAnalyticsUserId,
  setAppLanguage,
  setPreferredCampus,
} from '@/services/analytics';
import { setupAppCheck } from '@/services/app-check';
import { setupNotificationChannels } from '@/services/notification-channels';
import { ensureRegistered, requestPermission, getDeviceToken, onTokenRefresh } from '@/services/messaging';
import { getOrCreateDeviceId } from '@/services/device-id';
import { initializeFirestoreNotifications } from '@/services/firestore-notifications';
import { withRetry } from '@/utils/with-retry';

function resolveAppLanguage(): AppLanguage {
  const deviceLang = getLocales()[0]?.languageCode;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(deviceLang ?? '')
    ? (deviceLang as AppLanguage)
    : DEFAULT_LANGUAGE;
}

/**
 * Map AppLanguage ('ko' | 'en' | 'zh') to the subset the notification
 * subsystem supports ('ko' | 'en'). Chinese users receive Korean copy
 * because the server has no zh translation pipeline; see plan doc.
 */
function toNotificationLocale(lang: AppLanguage): 'ko' | 'en' {
  return lang === 'en' ? 'en' : 'ko';
}

/**
 * App initialization hook — runs once on mount.
 *
 * Sequence:
 * 1. Register Firebase token provider for the auth interceptor
 * 2. Sign in anonymously if no current user
 * 3. Force-create API client singleton (attaches all interceptors)
 * 4. Listen to auth state changes → sync to Zustand auth store
 *
 * Returns { isReady, error } for the InitGate to gate navigation.
 *
 * Flutter source: lib/core/data/api_client.dart (ensureAuth)
 */
export function useAppInit() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let unsubToken: (() => void) | undefined;

    async function init() {
      try {
        // 0. Disable Analytics collection in dev builds
        await disableAnalyticsInDev();

        // 0.5. Initialize App Check before any Firebase service calls
        await setupAppCheck();

        // 1. Configure Google Sign-In
        configureGoogleSignIn();

        // 2. Register token provider (decouples shared pkg from Firebase)
        setAuthTokenProvider(async (forceRefresh) => {
          const user = getAuth().currentUser;
          if (!user) return null;
          return user.getIdToken(forceRefresh);
        });

        // 2. Anonymous sign-in if needed
        if (!getAuth().currentUser) {
          await signInAnonymously(getAuth());
        }

        // 3. Force-create API client singleton (interceptors attached)
        getApiClient();

        // 4. Sync Firebase auth state → Zustand store + set analytics/crashlytics userId
        unsubscribe = onAuthStateChanged(getAuth(), (user) => {
          if (user) {
            if (__DEV__) {
              console.log('[auth] onAuthStateChanged:', {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                isAnonymous: user.isAnonymous,
                providerData: user.providerData.map((p) => p.providerId),
              });
            }
            authStore.getState().setAuthenticated({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              isAnonymous: user.isAnonymous,
            });
            setAnalyticsUserId(user.uid);
            setCrashlyticsUserId(user.uid);
          } else {
            if (__DEV__) console.log('[auth] onAuthStateChanged: signed out');
            authStore.getState().setUnauthenticated();
          }
        });

        // 5. FCM registration + Firestore bootstrap (Phase 2)
        //
        // Use requestPermission() here because it's idempotent on iOS — no
        // dialog appears if permission is already granted/denied. This gives
        // us correct behavior on first launch (prompt shows) without spurious
        // prompts on subsequent launches. Phase 3 will add a richer permission
        // UX via a master toggle, but the real OS-level dialog still flows
        // through here.
        await setupNotificationChannels();
        const deviceId = getOrCreateDeviceId();
        useNotificationStore.getState().setDeviceId(deviceId);

        const permStatus = await requestPermission();
        useNotificationStore.getState().setPermissionStatus(permStatus);

        if (permStatus === 'authorized' || permStatus === 'provisional') {
          await ensureRegistered();
          const fcmToken = await getDeviceToken();
          if (__DEV__) console.log('[fcm] token:', fcmToken);
          useNotificationStore.getState().setFcmToken(fcmToken);

          // Fire-and-forget Firestore bootstrap.
          // - Promise.all inside initializeFirestoreNotifications parallelizes reads
          // - withRetry absorbs transient failures (1s / 2s / 4s backoff)
          // - logHandledError on exhaustion; app launch is NOT blocked on this path
          const uid = getAuth().currentUser?.uid;
          if (uid && fcmToken) {
            const bootstrapLang = resolveAppLanguage();
            const osLocale = toNotificationLocale(bootstrapLang);
            const appVersion = Constants.expoConfig?.version ?? '0.0.0';
            const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

            withRetry(() =>
              initializeFirestoreNotifications({
                uid,
                deviceId,
                token: fcmToken,
                platform,
                appVersion,
                osLocale,
              }),
            )
              .then(() => {
                useNotificationStore.getState().setIsTokenRegistered(true);
              })
              .catch((err) => {
                logHandledError('notifications/init', err);
              });
          }
        }

        // 5.3 Safety net: APNs token can arrive late (iOS cold start), or FCM
        // token can rotate. Either way, re-register the device so Firestore
        // stays in sync without waiting for another app launch.
        unsubToken = onTokenRefresh((token) => {
          if (__DEV__) console.log('[fcm] token refreshed:', token);
          useNotificationStore.getState().setFcmToken(token);

          const uid = getAuth().currentUser?.uid;
          const storedDeviceId = useNotificationStore.getState().deviceId;
          if (!uid || !storedDeviceId) return;

          const appVersion = Constants.expoConfig?.version ?? '0.0.0';
          const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
          const osLocale = toNotificationLocale(resolveAppLanguage());

          withRetry(() =>
            initializeFirestoreNotifications({
              uid,
              deviceId: storedDeviceId,
              token,
              platform,
              appVersion,
              osLocale,
            }),
          )
            .then(() => useNotificationStore.getState().setIsTokenRegistered(true))
            .catch((err) => logHandledError('notifications/token-refresh', err));
        });

        // 6. Initialize Google Mobile Ads SDK (non-blocking — can be slow on simulator)
        mobileAds().initialize().then((adapterStatuses) => {
          if (__DEV__) {
            console.log('[AdMob] SDK initialized, adapter statuses:', JSON.stringify(adapterStatuses));
          }
        }).catch(() => {});

        // 6. Sync OS locale → Zustand store + analytics
        const lang = resolveAppLanguage();
        useSettingsStore.getState().setAppLanguage(lang);
        setAppLanguage(lang);
        setPreferredCampus('hssc');

        setIsReady(true);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : translate(resolveAppLanguage(), 'error.appStart');
        authStore.getState().setError(message);
        setError(message);
      }
    }

    init();

    // Re-sync locale when app returns to foreground (Android can change locale without restart)
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          const lang = resolveAppLanguage();
          useSettingsStore.getState().setAppLanguage(lang);
          setAppLanguage(lang);
        }
      },
    );

    return () => {
      unsubscribe?.();
      unsubToken?.();
      appStateSubscription.remove();
    };
  }, []);

  return { isReady, error };
}
