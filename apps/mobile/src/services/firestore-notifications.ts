import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import appCheck from '@react-native-firebase/app-check';
import { MANDATORY_TOPICS } from '@skkuverse/shared';
import type {
  DeviceDocument,
  PreferencesDocument,
  UserDocument,
} from '@skkuverse/shared';
import { logHandledError } from '@/services/crashlytics';

/**
 * Force-refresh the App Check token before a Firestore write.
 *
 * Workaround for a known Firebase SDK bug where a stale App Check token
 * causes server-side PERMISSION_DENIED on writes while the local cache still
 * accepts the mutation. The Promise resolves, onSnapshot fires with the local
 * cache, but the write never reaches the server until the app is restarted
 * (which issues a fresh App Check token). Users perceive this as "settings
 * only sync after app kill + reopen".
 *
 * References:
 *   - flutterfire#12799 (Firestore doesn't pick up refreshed App Check token)
 *   - firebase-android-sdk#5235 (AppCheck doesn't schedule auto-refresh when
 *     a stored token exists)
 *
 * Failures are swallowed — if the refresh fails, we let the write proceed
 * with the cached token so we never block on a bad network.
 */
async function primeAppCheck(): Promise<void> {
  try {
    const { token } = await appCheck().getToken(true);
    // [fcm-diag] temporary: confirm whether App Check actually returns a fresh
    // token on every call. If Firestore writes still stall while this logs a
    // changing token head, the cache lives inside Firestore (H3), not inside
    // the App Check module.
    console.log(
      '[fcm-diag] app-check token head:',
      token.slice(0, 24),
      'len:',
      token.length,
    );
  } catch (e) {
    console.warn('[fcm-diag] app-check refresh FAILED:', e);
    logHandledError('fcm-diag/app-check-refresh', e);
  }
}

/**
 * Firestore service for the push-notification subsystem (Phase 2, option D).
 *
 * Pattern mirrors services/analytics.ts — thin wrappers around the Firebase SDK.
 * Callers are expected to handle errors; this module does not swallow them
 * because useAppInit wraps bootstrap calls in withRetry() and reports to
 * Crashlytics on exhaustion.
 *
 * No `notifications` collection — option D. Only users / preferences / devices.
 */

const USERS = 'users';
const PREFERENCES = 'preferences';
const PREFERENCES_DOC_ID = 'main';
const DEVICES = 'devices';

// ── Reads ────────────────────────────────────────────────────────

export async function getUserDoc(uid: string): Promise<UserDocument | null> {
  const snap = await firestore().collection(USERS).doc(uid).get();
  if (!snap.exists()) return null;
  return snap.data() as UserDocument;
}

export async function getPreferences(
  uid: string,
): Promise<PreferencesDocument | null> {
  const snap = await firestore()
    .collection(USERS)
    .doc(uid)
    .collection(PREFERENCES)
    .doc(PREFERENCES_DOC_ID)
    .get();
  if (!snap.exists()) return null;
  return snap.data() as PreferencesDocument;
}

// ── Writes ───────────────────────────────────────────────────────

export async function updateUserLocale(
  uid: string,
  locale: 'ko' | 'en',
): Promise<void> {
  await primeAppCheck();
  await firestore()
    .collection(USERS)
    .doc(uid)
    .set({ locale } satisfies UserDocument, { merge: true });
}

export async function updatePreferences(
  uid: string,
  prefs: PreferencesDocument,
): Promise<void> {
  // [fcm-diag] temporary instrumentation: measure write-path timing so we can
  // tell a local-cache-only resolve (<50ms, no server ack) apart from a real
  // server round-trip, and catch the case where the handler never fires at all.
  const t0 = Date.now();
  console.log('[fcm-diag] updatePreferences START', {
    uid,
    enabled: prefs.enabled,
    topicCount: prefs.subscribedTopics.length,
  });
  try {
    await primeAppCheck();
    const mergedTopics = [
      ...new Set([...prefs.subscribedTopics, ...MANDATORY_TOPICS]),
    ];
    const payload: PreferencesDocument = {
      enabled: prefs.enabled,
      subscribedTopics: mergedTopics,
    };
    await firestore()
      .collection(USERS)
      .doc(uid)
      .collection(PREFERENCES)
      .doc(PREFERENCES_DOC_ID)
      .set(payload);
    console.log(
      '[fcm-diag] updatePreferences SET resolved in',
      Date.now() - t0,
      'ms',
    );
  } catch (e) {
    console.warn(
      '[fcm-diag] updatePreferences ERROR after',
      Date.now() - t0,
      'ms:',
      e,
    );
    logHandledError('fcm-diag/update-preferences', e);
    throw e;
  }
}

export async function disableNotifications(uid: string): Promise<void> {
  await primeAppCheck();
  await firestore()
    .collection(USERS)
    .doc(uid)
    .collection(PREFERENCES)
    .doc(PREFERENCES_DOC_ID)
    .update({ enabled: false });
}

export async function registerDevice(
  deviceId: string,
  data: DeviceDocument,
): Promise<void> {
  await primeAppCheck();
  // serverTimestamp() avoids clock-skew between client and server.
  await firestore()
    .collection(DEVICES)
    .doc(deviceId)
    .set(
      {
        ...data,
        lastActive: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function unregisterDevice(deviceId: string): Promise<void> {
  await primeAppCheck();
  await firestore()
    .collection(DEVICES)
    .doc(deviceId)
    .update({ active: false });
}

// ── Realtime subscription ────────────────────────────────────────

export function onPreferencesChanged(
  uid: string,
  callback: (prefs: PreferencesDocument | null) => void,
): () => void {
  return firestore()
    .collection(USERS)
    .doc(uid)
    .collection(PREFERENCES)
    .doc(PREFERENCES_DOC_ID)
    .onSnapshot(
      (snap: FirebaseFirestoreTypes.DocumentSnapshot) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        callback(snap.data() as PreferencesDocument);
      },
      (err) => {
        // [fcm-diag] temporary: surface error CODE (not just message) so we can
        // distinguish permission-denied (App Check) from unauthenticated (auth)
        // from unavailable (network). Crashlytics log promotes this out of the
        // dev-only warn so release builds can confirm the fix in production.
        // v24 types: FirestoreError is aliased to Error and drops the `code`
        // field from the type, but the runtime object still carries it.
        const code = (err as { code?: string }).code;
        console.warn('[fcm-diag] onSnapshot error:', code, err.message);
        logHandledError('fcm-diag/onSnapshot', err);
      },
    );
}

// ── Bootstrap orchestration ──────────────────────────────────────

interface BootstrapParams {
  uid: string;
  deviceId: string;
  token: string;
  platform: 'ios' | 'android';
  appVersion: string;
  osLocale: 'ko' | 'en';
}

/**
 * Phase 2.6 orchestration — called once from useAppInit per launch.
 *
 * 1. Parallel read of users/{uid} and users/{uid}/preferences/main
 * 2. If either missing, create both (in parallel) using the OS locale /
 *    MANDATORY_TOPICS defaults
 * 3. Register/refresh devices/{deviceId} with the latest token + locale +
 *    subscribedTopics + notificationsEnabled copies (query-optimization
 *    replication of preferences fields and users.locale)
 */
export async function initializeFirestoreNotifications(
  params: BootstrapParams,
): Promise<void> {
  const { uid, deviceId, token, platform, appVersion, osLocale } = params;

  // 1. Parallel read — existing prefs override new defaults; locale is
  //    always refreshed from the OS below (users/{uid}.locale tracks the
  //    current device's top preference, not a one-time snapshot).
  const [userDoc, prefsDoc] = await Promise.all([
    getUserDoc(uid),
    getPreferences(uid),
  ]);

  // 2. Locale: always sync to current OS detection on each launch.
  //    prefs: create defaults only if missing (respects user toggles from Phase 3 UI).
  const bootstrap: Promise<void>[] = [];
  if (userDoc?.locale !== osLocale) {
    bootstrap.push(updateUserLocale(uid, osLocale));
  }
  if (!prefsDoc) {
    bootstrap.push(
      updatePreferences(uid, {
        enabled: false,
        subscribedTopics: [...MANDATORY_TOPICS],
      }),
    );
  }
  if (bootstrap.length > 0) {
    await Promise.all(bootstrap);
  }

  // 3. Device registration with replicated fields — locale mirrors the OS,
  //    not a stale cached userDoc value (that was the ko-sticky bug).
  const finalPrefs: PreferencesDocument = prefsDoc ?? {
    enabled: false,
    subscribedTopics: [...MANDATORY_TOPICS],
  };

  await registerDevice(deviceId, {
    uid,
    token,
    platform,
    appVersion,
    lastActive: new Date(), // overridden by serverTimestamp() inside registerDevice
    active: true,
    subscribedTopics: finalPrefs.subscribedTopics,
    notificationsEnabled: finalPrefs.enabled,
    locale: osLocale,
  });
}
