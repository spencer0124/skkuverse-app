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
  useBookmarkStore,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  t as translate,
} from '@skkuverse/shared';
import type { AppLanguage } from '@skkuverse/shared';
import mobileAds from 'react-native-google-mobile-ads';
import { setCrashlyticsUserId, logHandledError } from '@/services/crashlytics';
import { configureGoogleSignIn, syncProfileFromProviderData } from '@/services/google-auth';
import {
  disableAnalyticsInDev,
  setAnalyticsUserId,
  setAppLanguage,
  setPreferredCampus,
} from '@/services/analytics';
import { setupAppCheck } from '@/services/app-check';
import firestore from '@react-native-firebase/firestore';
import { setupNotificationChannels } from '@/services/notification-channels';
import { ensureRegistered, requestPermission, getDeviceToken, onTokenRefresh } from '@/services/messaging';
import { getOrCreateDeviceId } from '@/services/device-id';
import {
  initializeFirestoreNotifications,
  onPreferencesChanged,
  updateUserLocale,
} from '@/services/firestore-notifications';
import { onBookmarksChanged } from '@/services/firestore-bookmarks';
import { withRetry } from '@/utils/with-retry';

// Verbose Firestore logging in dev builds so write-stream stalls become
// visible (otherwise the SDK silently parks mutations on certain timings).
// No-op in release builds.
if (__DEV__) {
  try {
    firestore.setLogLevel('debug');
  } catch {
    /* ignore — some RNFB versions swallow the call off module scope */
  }
}

/**
 * Walks the user's ordered preference list from `getLocales()` and returns
 * the first entry whose languageCode is supported. This matches iOS behavior
 * where a bilingual user with "English > Korean" at Settings → General →
 * Language & Region → Preferred Language Order expects English UI even
 * though their Region is set to South Korea.
 *
 * The previous implementation read only `getLocales()[0]`, so if the top
 * preference happened to be unsupported (e.g. Spanish) we fell straight to
 * DEFAULT_LANGUAGE and ignored the user's second preference entirely.
 */
function resolveAppLanguage(): AppLanguage {
  const supported = SUPPORTED_LANGUAGES as readonly string[];
  for (const locale of getLocales()) {
    const code = locale.languageCode;
    if (code && supported.includes(code)) {
      return code as AppLanguage;
    }
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Map AppLanguage ('ko' | 'en' | 'zh') to the subset the notification
 * subsystem supports ('ko' | 'en'). Chinese users fall through to English
 * (not Korean) — less jarring for non-Korean readers until the zh pipeline
 * ships. Settings screen surfaces a hint banner explaining this.
 */
function toNotificationLocale(lang: AppLanguage): 'ko' | 'en' {
  return lang === 'ko' ? 'ko' : 'en';
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
    // Firestore preferences/main onSnapshot listener — re-subscribed on every
    // uid transition (anon → Google, Google → anon). The store's preferences
    // field is no longer persisted (see store/notifications.ts partialize),
    // so this listener is the sole source of truth on the client.
    let unsubPrefs: (() => void) | undefined;
    let prefsListenerUid: string | null = null;

    // Firestore users/{uid}/bookmarks/* onSnapshot listener — same uid-scoped
    // lifecycle as unsubPrefs above. The Zustand bookmark store is not MMKV-
    // persisted; the listener is the sole hydration path on the client. On
    // sign-out we both detach the listener AND clearEntries() — without the
    // explicit clear, the next anon user on a shared device would see the
    // prior Google user's bookmarks for ~1s until the new listener attaches.
    let unsubBookmarks: (() => void) | undefined;
    let bookmarksListenerUid: string | null = null;

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
        unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
          // Task #12: detect uid transitions (anon → Google, Google → new-anon
          // on sign-out, credential-already-in-use fallback). On transition,
          // re-run the Firestore bootstrap so devices/{id}.uid follows the
          // current authenticated uid. Relies on lastKnownUid surviving the
          // null/signed-out intermediate state — see auth store comment.
          const prevUid = authStore.getState().lastKnownUid;

          if (user) {
            // Self-heal: backfill displayName/photoURL on Auth record when a
            // pre-fix session is restored without them. linkWithCredential
            // (anon→Google) leaves these fields null on the Auth record while
            // populating providerData[google.com]. Once written here, every
            // subsequent cold start sees the correct values immediately.
            // Early-returns when fields are already set, so this is a one-shot
            // upgrade that becomes a no-op on later launches.
            await syncProfileFromProviderData(user);

            if (__DEV__) {
              console.log('[auth] onAuthStateChanged:', {
                prevUid,
                newUid: user.uid,
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

            // Transition detection. First-login case (prevUid === null) is
            // skipped here — the bootstrap block below handles it. We only
            // fire migration when there's a real uid change on the same
            // physical device.
            //
            // deviceId is read from getOrCreateDeviceId() directly rather
            // than useNotificationStore, because the auth listener can fire
            // before line ~165's setDeviceId() runs. The function is
            // MMKV-cached and idempotent, so this is free.
            //
            // fcmToken may legitimately be null (permission denied, APNs
            // still pending) — in that case no device doc exists yet and
            // there is nothing to migrate. onTokenRefresh at line ~220 will
            // register the doc under the then-current uid when the token
            // eventually arrives. No recovery path needed here.
            if (prevUid && prevUid !== user.uid) {
              const deviceId = getOrCreateDeviceId();
              const fcmToken = useNotificationStore.getState().fcmToken;
              if (deviceId && fcmToken) {
                const appVersion = Constants.expoConfig?.version ?? '0.0.0';
                const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
                const osLocale = toNotificationLocale(resolveAppLanguage());

                withRetry(() => {
                  // Resolve uid lazily per attempt so retries track the
                  // current auth state — guards against a mid-retry
                  // transition landing a stale uid (Task #12 race).
                  const currentUid = getAuth().currentUser?.uid;
                  if (!currentUid) {
                    throw new Error('no authenticated user');
                  }
                  return initializeFirestoreNotifications({
                    uid: currentUid,
                    deviceId,
                    token: fcmToken,
                    platform,
                    appVersion,
                    osLocale,
                  });
                }).catch((err) =>
                  logHandledError('notifications/auth-transition', err),
                );
              }
            }

            authStore.setState({ lastKnownUid: user.uid });

            // Re-attach preferences listener if the uid changed (or first
            // attach). onSnapshot subscriptions are uid-scoped — the prior
            // listener pumped the prior user's prefs into our store, so we
            // tear it down before opening a new one. Anonymous users hit
            // this path too: doc usually doesn't exist for them, so the
            // callback fires with null and the store keeps its defaults.
            if (prefsListenerUid !== user.uid) {
              unsubPrefs?.();
              prefsListenerUid = user.uid;
              unsubPrefs = onPreferencesChanged(user.uid, (prefs) => {
                if (!prefs) return;
                useNotificationStore.getState().setPreferences(prefs);

                // Auto-restore onboarding state from Firestore SSOT
                // (cold-start fallback). Primary path: notices/index.tsx
                // handleExistingAccountSignIn calls restoreOnboardingFromRemote
                // synchronously after sign-in for UX immediacy. This listener
                // handles the OTHER path: cold-start where a returning user is
                // already authed (no sign-in event fires) — e.g. app re-launch
                // after install + initial sign-in, or session restore.
                //
                // Discriminator: prefs.onboardedAt != null. Set by
                // seedOnboardingPreferences as serverTimestamp().
                // initializeFirestoreNotifications's default doc has
                // onboardedAt: null so anon/first-time installers don't trip.
                //
                // 'dept' tab key cross-link: this listener mirrors
                // prefs.pickerSelections.dept to MMKV. Same hard-code in
                // notices/index.tsx handler + server-side tabsContract.ts —
                // coordinated rename required.
                //
                // Action overwrites unconditionally — safe because dual-write
                // writes identical data (handler reads same prefs the listener
                // observes). always-overwrite also self-heals account-switch
                // (logout A → signin B leaves A's stale data in MMKV otherwise).
                if (prefs.onboardedAt != null) {
                  const restoredDeptIds = prefs.pickerSelections?.dept ?? [];
                  if (restoredDeptIds.length > 0) {
                    useSettingsStore.getState().restoreOnboardingFromRemote({
                      primaryDeptId: restoredDeptIds[0],
                      interestDeptIds: restoredDeptIds.slice(1, 5),
                    });
                  } else {
                    // Corrupt state — onboardedAt set but dept empty. Listener
                    // can't navigate; just log so we notice in Crashlytics.
                    // Inline handler (notices/index.tsx) handles the same case
                    // by routing to wizard.
                    logHandledError(
                      'useAppInit/restore-corrupt-prefs',
                      new Error(
                        'onboardedAt set but pickerSelections.dept empty',
                      ),
                    );
                  }
                }
              });
            }

            // Bookmarks listener — same uid-scoped lifecycle as unsubPrefs.
            // Anon users hit this path too: their collection is empty and
            // the snapshot fires with `{}`, which `setEntries` writes as
            // an empty map (loaded=true).
            if (bookmarksListenerUid !== user.uid) {
              unsubBookmarks?.();
              bookmarksListenerUid = user.uid;
              unsubBookmarks = onBookmarksChanged(user.uid, (entries) => {
                useBookmarkStore.getState().setEntries(entries);
              });
            }
          } else {
            if (__DEV__) console.log('[auth] onAuthStateChanged: signed out');
            authStore.getState().setUnauthenticated();
            // Tear down the prefs listener — the prior uid is no longer
            // ours to read. The next signed-in onAuthStateChanged will
            // re-attach for the new uid.
            unsubPrefs?.();
            unsubPrefs = undefined;
            prefsListenerUid = null;
            // Bookmarks: detach listener + clearEntries. Without the
            // explicit clear, the next anon user on a shared device would
            // see the prior Google user's saved-list until the new listener
            // attaches and overwrites — privacy regression.
            unsubBookmarks?.();
            unsubBookmarks = undefined;
            bookmarksListenerUid = null;
            useBookmarkStore.getState().clearEntries();
            // ⚠️ lastKnownUid is intentionally preserved through this branch.
            // The next onAuthStateChanged(user) fires with the new anon uid
            // after signInAnonymously, and we need prevUid != newUid to
            // detect that transition. Resetting here breaks Task #12.
          }
        });

        // 5. FCM registration + Firestore bootstrap (Phase 2)
        //
        // Channels and deviceId are unconditional — needed regardless of
        // whether the user has granted notification permission yet (deviceId
        // is just a UUID, channels are Android display config).
        //
        // requestPermission() itself is gated behind two conditions:
        //   1. onboardingCompleted — user finished the wizard, so the
        //      NotificationStep already handled the first-time prompt.
        //   2. permissionStatus !== 'notDetermined' — if the user explicitly
        //      tapped "다음에 할게요" (skip), the persisted MMKV value stays
        //      'notDetermined'. Re-calling requestPermission() in that state
        //      would surface the iOS system dialog at launch — exactly what
        //      the wizard step was designed to prevent. The gate honors the
        //      user's deferral.
        //
        // For users who responded once (authorized/denied), requestPermission
        // is idempotent on iOS — returns the cached status without a dialog,
        // which keeps the token sync flow alive.
        await setupNotificationChannels();
        const deviceId = getOrCreateDeviceId();
        useNotificationStore.getState().setDeviceId(deviceId);

        const onboardingCompleted = useSettingsStore.getState().onboardingCompleted;
        const persistedStatus = useNotificationStore.getState().permissionStatus;
        const shouldQueryPermission =
          onboardingCompleted && persistedStatus !== 'notDetermined';

        if (shouldQueryPermission) {
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
            //
            // Task #12: uid is resolved lazily per retry attempt (inside the
            // closure) rather than captured once. This way, a retry landing
            // after a uid transition writes the current uid, not the stale
            // one that was live at the initial call.
            if (fcmToken) {
              const bootstrapLang = resolveAppLanguage();
              const osLocale = toNotificationLocale(bootstrapLang);
              const appVersion = Constants.expoConfig?.version ?? '0.0.0';
              const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

              withRetry(() => {
                const currentUid = getAuth().currentUser?.uid;
                if (!currentUid) {
                  throw new Error('no authenticated user');
                }
                return initializeFirestoreNotifications({
                  uid: currentUid,
                  deviceId,
                  token: fcmToken,
                  platform,
                  appVersion,
                  osLocale,
                });
              })
                .then(() => {
                  useNotificationStore.getState().setIsTokenRegistered(true);
                })
                .catch((err) => {
                  logHandledError('notifications/init', err);
                });
            }
          }
        }

        // 5.3 Safety net: APNs token can arrive late (iOS cold start), or FCM
        // token can rotate. Either way, re-register the device so Firestore
        // stays in sync without waiting for another app launch.
        unsubToken = onTokenRefresh((token) => {
          if (__DEV__) console.log('[fcm] token refreshed:', token);
          useNotificationStore.getState().setFcmToken(token);

          const storedDeviceId = useNotificationStore.getState().deviceId;
          if (!storedDeviceId) return;

          const appVersion = Constants.expoConfig?.version ?? '0.0.0';
          const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
          const osLocale = toNotificationLocale(resolveAppLanguage());

          // Lazy uid resolution per retry attempt — see Task #12 race notes
          // at the bootstrap block above.
          withRetry(() => {
            const currentUid = getAuth().currentUser?.uid;
            if (!currentUid) {
              throw new Error('no authenticated user');
            }
            return initializeFirestoreNotifications({
              uid: currentUid,
              deviceId: storedDeviceId,
              token,
              platform,
              appVersion,
              osLocale,
            });
          })
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

    // P0-3: mid-session language change → Firestore users.locale.
    // Keep the side-effect here (not in shared/setAppLanguage) so packages/shared
    // stays pure state and mobile owns the Firestore dependency. Cloud Function
    // syncUserLocaleToDevices propagates the change to devices.locale.
    const unsubLocale = useSettingsStore.subscribe((state, prev) => {
      if (state.appLanguage === prev.appLanguage) return;
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      const nextLocale = toNotificationLocale(state.appLanguage);
      void updateUserLocale(uid, nextLocale).catch((err) => {
        logHandledError('notifications/locale-sync', err);
      });
    });

    return () => {
      unsubscribe?.();
      unsubToken?.();
      unsubPrefs?.();
      unsubBookmarks?.();
      unsubLocale();
      appStateSubscription.remove();
    };
  }, []);

  return { isReady, error };
}
