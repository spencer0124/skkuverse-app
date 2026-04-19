import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getAuth, signInAnonymously, onAuthStateChanged } from '@react-native-firebase/auth';
import { getLocales } from 'expo-localization';
import {
  setAuthTokenProvider,
  getApiClient,
  authStore,
  useSettingsStore,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  t as translate,
} from '@skkuverse/shared';
import type { AppLanguage } from '@skkuverse/shared';
import mobileAds from 'react-native-google-mobile-ads';
import { setCrashlyticsUserId } from '@/services/crashlytics';
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

function resolveAppLanguage(): AppLanguage {
  const deviceLang = getLocales()[0]?.languageCode;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(deviceLang ?? '')
    ? (deviceLang as AppLanguage)
    : DEFAULT_LANGUAGE;
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

        // 5. FCM registration
        // Correct order: requestPermission → ensureRegistered → getDeviceToken
        // requestPermission() is idempotent — no dialog if already granted
        await setupNotificationChannels();
        getOrCreateDeviceId(); // ensure deviceId is persisted early

        // 5.1 Permission (idempotent — won't show dialog if already granted)
        const permStatus = await requestPermission();

        // 5.2 Register + get token if authorized
        if (permStatus === 'authorized' || permStatus === 'provisional') {
          await ensureRegistered();
          const fcmToken = await getDeviceToken(); // waits for APNs token internally
          if (__DEV__) {
            console.log('[fcm] token:', fcmToken);
          }
          // Phase 2: Firestore device registration here
        }

        // 5.3 Safety net: if APNs token arrives late, onTokenRefresh catches it
        unsubToken = onTokenRefresh((token) => {
          if (__DEV__) console.log('[fcm] token refreshed:', token);
          // Phase 2: Firestore re-registration here
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
