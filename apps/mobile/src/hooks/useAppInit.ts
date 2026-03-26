import { useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import {
  setAuthTokenProvider,
  getApiClient,
  authStore,
} from '@skkuuniverse/shared';

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

        // 4. Sync Firebase auth state → Zustand store
        unsubscribe = auth().onAuthStateChanged((user) => {
          if (user) {
            authStore.getState().setAuthenticated(user.uid);
          } else {
            authStore.getState().setUnauthenticated();
          }
        });

        setIsReady(true);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : '앱을 시작할 수 없어요';
        authStore.getState().setError(message);
        setError(message);
      }
    }

    init();

    return () => {
      unsubscribe?.();
    };
  }, []);

  return { isReady, error };
}
