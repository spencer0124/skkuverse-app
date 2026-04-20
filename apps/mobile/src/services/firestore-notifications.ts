import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { MANDATORY_TOPICS } from '@skkuverse/shared';
import type {
  DeviceDocument,
  PreferencesDocument,
  UserDocument,
} from '@skkuverse/shared';

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
  await firestore()
    .collection(USERS)
    .doc(uid)
    .set({ locale } satisfies UserDocument, { merge: true });
}

export async function updatePreferences(
  uid: string,
  prefs: PreferencesDocument,
): Promise<void> {
  // MANDATORY_TOPICS are always included (and deduped); security is defense
  // in depth — the plan notes MANDATORY_TOPICS is currently empty, so this
  // set is a no-op today but future-proofs the write path.
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
}

export async function disableNotifications(uid: string): Promise<void> {
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
        if (__DEV__) console.warn('[firestore-notifications] onSnapshot error:', err);
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
