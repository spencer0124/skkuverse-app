import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import auth from '@react-native-firebase/auth';
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
import {
  disableAnalyticsInDev,
  setAnalyticsUserId,
  setAppLanguage,
  setPreferredCampus,
} from '@/services/analytics';

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

    async function init() {
      try {
        // 0. Disable Analytics collection in dev builds
        await disableAnalyticsInDev();

        // 1. Register token provider (decouples shared pkg from Firebase)
        setAuthTokenProvider(async (forceRefresh) => {
          const user = auth().currentUser;
          if (!user) return null;
          return user.getIdToken(forceRefresh);
        });

        // 2. Anonymous sign-in if needed
        if (!auth().currentUser) {
          await auth().signInAnonymously();
        }

        // 3. Force-create API client singleton (interceptors attached)
        getApiClient();

        // 3.5. Initialize Google Mobile Ads SDK
        await mobileAds().initialize();

        // 4. Sync Firebase auth state → Zustand store + set analytics/crashlytics userId
        unsubscribe = auth().onAuthStateChanged((user) => {
          if (user) {
            authStore.getState().setAuthenticated(user.uid);
            setAnalyticsUserId(user.uid);
            setCrashlyticsUserId(user.uid);
          } else {
            authStore.getState().setUnauthenticated();
          }
        });

        // 5. Sync OS locale → Zustand store + analytics
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
      appStateSubscription.remove();
    };
  }, []);

  return { isReady, error };
}
