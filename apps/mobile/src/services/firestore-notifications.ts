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
 * Onboarding seed / finalize (Phase E + 2026-05-25 redesign).
 *
 * Two-phase flow:
 *   - Step 6 진입 시점: opts={enabled:true, finalize:false} 호출 →
 *     onboardedAt:null 로 시드, 이후 NoticeCategoriesStep에서 setNoticeTabEnabled로
 *     라이브 토글 가능. Step 7 finalize에서 finalizeOnboardingAccepted로 null→timestamp 전환.
 *   - "안 받을게요" 경로: opts={enabled:false, finalize:true} 호출 →
 *     master OFF + categoryEnabled.notices=false + onboardedAt=timestamp 한 번에.
 *
 * CRITICAL: doc 존재 분기 — `.set()` 직접 사용 시 update path로 평가되며
 * CF가 채운 subscribedTopics와 diff → rules의 affectedKeys().hasAny(['subscribedTopics'])
 * 에 걸려 PERMISSION_DENIED 회귀. 따라서 항상 doc 존재 확인 후:
 *   - 없음: .set() 으로 전체 seed (essential 항상 true — rules invariant)
 *   - 있음: dot-path update 로 변경할 필드만 (subscribedTopics 미접촉)
 *
 * onboardedAt invariant (firestore.rules:65-69):
 *   resource.data.onboardedAt == request.resource.data.onboardedAt
 *   || (resource.data.onboardedAt == null && request.resource.data.onboardedAt is timestamp)
 * — 이미 timestamp인 경우 onboardedAt을 update payload에서 누락하면 unchanged로 통과.
 */
export async function seedOnboardingPreferences(
  uid: string,
  pickerSelections: Record<string, string[]>,
  opts: { enabled?: boolean; finalize?: boolean } = { enabled: true, finalize: true },
): Promise<void> {
  const enabled = opts.enabled ?? true;
  const finalize = opts.finalize ?? true;
  await primeAppCheck();

  const existing = await getPreferences(uid);

  if (!existing) {
    const seed: PreferencesDocument = {
      enabled,
      // essential은 rules invariant로 항상 true. notices는 master와 동기화
      // — enabled=false면 명시적으로 false 시드 (declined intent를 SSOT에 기록).
      categoryEnabled: { essential: true, services: false, notices: enabled },
      // Empty record = all 9 notice tabs default-on per derive() contract.
      noticeTabEnabled: {},
      pickerSelections,
      subscribedTopics: [],
      derivedAt: null,
      onboardedAt: finalize
        ? (firestore.FieldValue.serverTimestamp() as unknown)
        : null,
    };
    await prefsRef(uid).set(seed);
    return;
  }

  // doc 있음 — dot-path update만. subscribedTopics/derivedAt 미접촉으로 rules 통과.
  // noticeTabEnabled: {} 로 map 전체 재설정 (wizard 재진입 = 새 시드 의도).
  // 이전 settings에서 사용자가 토글한 OFF 값이 stale로 남으면 step 6 UX 혼란
  // (사용자가 이 세션에 끄지 않은 탭이 OFF로 보임). Firestore update 시
  // map 필드에 빈 객체를 지정하면 sub-key 전부 삭제됨.
  const updates: Record<string, unknown> = {
    enabled,
    'categoryEnabled.notices': enabled,
    noticeTabEnabled: {},
  };
  for (const [tabKey, ids] of Object.entries(pickerSelections)) {
    updates[`pickerSelections.${tabKey}`] = ids;
  }
  // onboardedAt은 finalize=true 이고 기존이 null 일 때만 포함 (null→timestamp 한 방향).
  // 이미 timestamp 이면 unchanged로 통과시키기 위해 payload에서 누락.
  if (finalize && existing.onboardedAt == null) {
    updates.onboardedAt = firestore.FieldValue.serverTimestamp();
  }
  await prefsRef(uid).update(updates);
}

/**
 * Step 7 ACCEPT 경로의 finalize.
 *
 * prepareCategoryStep에서 doc이 이미 seed됨 (보장). 여기서는 onboardedAt만
 * null→serverTimestamp() 단일 dot-path update로 전환.
 *
 * 만약 doc이 없거나(이론상 불가) onboardedAt이 이미 timestamp(중복 호출)면
 * rules가 reject할 수 있음 — 호출 측에서 try/catch로 non-fatal 처리.
 */
export async function finalizeOnboardingAccepted(uid: string): Promise<void> {
  await primeAppCheck();
  await prefsRef(uid).update({
    onboardedAt: firestore.FieldValue.serverTimestamp(),
  });
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
