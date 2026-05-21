import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import appCheck from '@react-native-firebase/app-check';
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
    await appCheck().getToken(true);
  } catch (e) {
    logHandledError('notifications/app-check-refresh', e);
  }
}

/**
 * Firestore service for the push-notification subsystem (v5 SSOT, option D).
 *
 * Pattern mirrors services/analytics.ts — thin wrappers around the Firebase SDK.
 * Callers are expected to handle errors; this module does not swallow them
 * because useAppInit wraps bootstrap calls in withRetry() and reports to
 * Crashlytics on exhaustion.
 *
 * v5 design (2026-04-25):
 * - Clients write only intent: enabled / categoryEnabled / pickerSelections.
 * - The Cloud Function `onPreferencesWrite` derives `subscribedTopics`
 *   server-side; Firestore Rules (Phase F) block client writes of derived
 *   fields. The three `set*` wrappers below are the only client write API.
 * - No transactions — Firestore queues writes offline, transactions fail
 *   immediately offline (campus wifi sucks, dead spots happen).
 *
 * No `notifications` collection — option D. Only users / preferences / devices.
 */

const USERS = 'users';
const PREFERENCES = 'preferences';
const PREFERENCES_DOC_ID = 'main';
const DEVICES = 'devices';

function prefsRef(uid: string) {
  return firestore()
    .collection(USERS)
    .doc(uid)
    .collection(PREFERENCES)
    .doc(PREFERENCES_DOC_ID);
}

// ── Reads ────────────────────────────────────────────────────────

export async function getUserDoc(uid: string): Promise<UserDocument | null> {
  const snap = await firestore().collection(USERS).doc(uid).get();
  if (!snap.exists()) return null;
  return snap.data() as UserDocument;
}

export async function getPreferences(
  uid: string,
): Promise<PreferencesDocument | null> {
  const snap = await prefsRef(uid).get();
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

export async function setMasterEnabled(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await primeAppCheck();
  await prefsRef(uid).update({ enabled });
}

export async function setCategoryEnabled(
  uid: string,
  key: 'essential' | 'services' | 'notices',
  on: boolean,
): Promise<void> {
  await primeAppCheck();
  await prefsRef(uid).update({ [`categoryEnabled.${key}`]: on });
}

/**
 * Per-notice-tab on/off. tabKey is one of the 9 server tab keys
 * (academic / scholarship / career / recruitment / event / dept / library /
 *  dorm / general). Only meaningful when categoryEnabled.notices is true —
 * the CF derive returns [] regardless when the super-category is OFF.
 */
export async function setNoticeTabEnabled(
  uid: string,
  tabKey: string,
  on: boolean,
): Promise<void> {
  await primeAppCheck();
  await prefsRef(uid).update({ [`noticeTabEnabled.${tabKey}`]: on });
}

export async function setPickerSelectionRemote(
  uid: string,
  tabKey: string,
  ids: string[],
): Promise<void> {
  await primeAppCheck();
  await prefsRef(uid).update({ [`pickerSelections.${tabKey}`]: ids });
}

/**
 * Onboarding completion seed (Phase E).
 *
 * Replaces the doc with explicit intent defaults: master ON, essential +
 * notices ON, services OFF. The caller assembles `pickerSelections` per tab
 * — typically dept (user picks) + library/dorm (common + campus defaults
 * via `computeOnboardingPickerSeed`). Tabs intentionally without defaults
 * (e.g. general) should be omitted entirely so derive() emits 0 topics for
 * them rather than an explicit empty-list intent.
 *
 * `subscribedTopics: []` — the CF onPreferencesWrite trigger fills it in
 * within 1~3s after this write lands.
 *
 * `onboardedAt: serverTimestamp()` — clock skew 방어. Canonical "user has
 * onboarded on some device" signal — second-device sign-in uses
 * `prefs.onboardedAt != null` to skip the wizard
 * (useAppInit prefs listener + notices/index.tsx handleExistingAccountSignIn).
 * Firestore Rules enforce "null → timestamp" one-way transition; repeated
 * calls update path will be rejected if onboardedAt was already set.
 */
export async function seedOnboardingPreferences(
  uid: string,
  pickerSelections: Record<string, string[]>,
): Promise<void> {
  await primeAppCheck();
  const seed: PreferencesDocument = {
    enabled: true,
    categoryEnabled: { essential: true, services: false, notices: true },
    // Empty record = all 9 notice tabs default-on per derive() contract.
    // User can selectively turn off in Settings later.
    noticeTabEnabled: {},
    pickerSelections,
    subscribedTopics: [],
    derivedAt: null,
    onboardedAt: firestore.FieldValue.serverTimestamp() as unknown,
  };
  await prefsRef(uid).set(seed);
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
  return prefsRef(uid).onSnapshot(
    (snap: FirebaseFirestoreTypes.DocumentSnapshot) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.data() as PreferencesDocument);
    },
    (err) => {
      logHandledError('notifications/onSnapshot', err);
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
 * Bootstrap orchestration — called once from useAppInit per launch.
 *
 * 1. Parallel read of users/{uid} and users/{uid}/preferences/main
 * 2. Lazily seed missing user/preferences with intent-only defaults.
 *    The CF onPreferencesWrite derives subscribedTopics on first write.
 *    Onboarding writes its own seed (Phase E) which supersedes this minimal
 *    default; this branch handles app reinstalls or anon→Google transitions
 *    where onboarding doesn't run.
 * 3. Register/refresh devices/{deviceId} with replicated subscribedTopics +
 *    notificationsEnabled fields (query-optimization replicas; CF
 *    syncPreferencesToDevices keeps them in sync after derive runs).
 */
export async function initializeFirestoreNotifications(
  params: BootstrapParams,
): Promise<void> {
  const { uid, deviceId, token, platform, appVersion, osLocale } = params;

  const [userDoc, prefsDoc] = await Promise.all([
    getUserDoc(uid),
    getPreferences(uid),
  ]);

  const bootstrap: Promise<void>[] = [];
  if (userDoc?.locale !== osLocale) {
    bootstrap.push(updateUserLocale(uid, osLocale));
  }

  const defaultPrefs: PreferencesDocument = {
    enabled: false,
    categoryEnabled: { essential: false, services: false, notices: false },
    noticeTabEnabled: {},
    pickerSelections: {},
    subscribedTopics: [],
    derivedAt: null,
    onboardedAt: null,
  };
  if (!prefsDoc) {
    // Use full set with merge:false to create the doc with the v5 shape.
    // Rules (Phase F) require subscribedTopics to be empty on create —
    // defaultPrefs.subscribedTopics = [] satisfies this.
    await primeAppCheck();
    bootstrap.push(prefsRef(uid).set(defaultPrefs));
  }
  if (bootstrap.length > 0) {
    await Promise.all(bootstrap);
  }

  const finalPrefs: PreferencesDocument = prefsDoc ?? defaultPrefs;

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
