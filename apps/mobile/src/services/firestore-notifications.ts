import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import {
  isMissingPrefsDocError,
  type DeviceDocument,
  type PreferencesDocument,
  type UserDocument,
} from '@skkuverse/shared';
import { writeWithSelfHeal } from '@/services/prefs-self-heal';
import { primeAppCheck } from '@/services/app-check-prime';
import { logHandledError } from '@/services/crashlytics';

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

/**
 * Every `preferences/main` writer below goes through this.
 *
 * `update()` is a patch mutation, so all of them fail permanently for a user
 * whose document is missing — the ghost state behind the 2026-07 and 2026-09
 * department-picker bugs. Routing them through one wrapper means a future
 * writer inherits the recovery instead of reproducing the bug; the ordering
 * rationale (write first, never seed first) lives in prefs-self-heal.ts.
 *
 * `restore` is threaded through so the healed document carries the user's
 * actual MMKV selection rather than an empty one. Without it the seed lands
 * with `onboardedAt: null`, and since `ensurePreferencesDoc` early-returns on
 * an existing document that null is permanent — second-device auto-restore
 * would never fire for that user again.
 */
async function updatePrefsWithSelfHeal(
  uid: string,
  mutation: Record<string, unknown>,
  restore?: { pickerSelections: Record<string, string[]>; onboarded: boolean },
): Promise<void> {
  await primeAppCheck();
  await writeWithSelfHeal({
    write: () => prefsRef(uid).update(mutation),
    ensure: () => ensurePreferencesDoc(uid, restore),
    isRecoverable: isMissingPrefsDocError,
    onEnsureError: (err) => logHandledError('notifications/self-heal-seed', err),
  });
}

export async function setMasterEnabled(
  uid: string,
  enabled: boolean,
): Promise<void> {
  await updatePrefsWithSelfHeal(uid, { enabled });
}

export async function setCategoryEnabled(
  uid: string,
  key: 'essential' | 'services' | 'notices',
  on: boolean,
): Promise<void> {
  await updatePrefsWithSelfHeal(uid, { [`categoryEnabled.${key}`]: on });
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
  await updatePrefsWithSelfHeal(uid, { [`noticeTabEnabled.${tabKey}`]: on });
}

export async function setPickerSelectionRemote(
  uid: string,
  tabKey: string,
  ids: string[],
  restore?: { pickerSelections: Record<string, string[]>; onboarded: boolean },
): Promise<void> {
  await updatePrefsWithSelfHeal(
    uid,
    { [`pickerSelections.${tabKey}`]: ids },
    restore,
  );
}

/**
 * Mini-app push subscription — one id at a time.
 *
 * arrayUnion/arrayRemove rather than read-modify-write: a single-field atomic
 * mutation that Firestore can queue offline, which keeps the no-transactions
 * invariant that exists because transactions fail immediately in a campus wifi
 * dead spot. Two devices toggling different mini apps therefore cannot clobber
 * each other's list.
 *
 * No Firestore Rules change was needed for this field. The `preferences/main`
 * update rule is a DENYLIST — it rejects `subscribedTopics` and `derivedAt` by
 * name rather than allowlisting with `hasOnly` — so a new intent field is
 * admitted as-is. (Had it been an allowlist, every new intent field would need
 * an app release and a rules deploy landed in lockstep.)
 *
 * Self-heals a missing document because `update()` is a patch mutation, which
 * is exactly the state an anonymous or never-onboarded user is in — and those
 * users are allowed to subscribe.
 *
 * The topic this becomes, `miniapp:<id>`, is derived server-side by the Cloud
 * Function. Until that ships (skkuverse#17) this field is recorded intent that
 * delivers nothing, which is the correct order: intent before delivery.
 */
export async function setMiniAppSubscribed(
  uid: string,
  miniAppId: string,
  on: boolean,
): Promise<void> {
  await primeAppCheck();
  const mutation = {
    miniAppSelections: on
      ? firestore.FieldValue.arrayUnion(miniAppId)
      : firestore.FieldValue.arrayRemove(miniAppId),
  };

  // Seeding-on-failure lives in updatePrefsWithSelfHeal now.
  //
  // The hand-rolled version here tested `code !== 'firestore/not-found'` and
  // was therefore dead code: a missing document is reported as
  // PERMISSION_DENIED, because `allow update` dereferences `resource.data` and
  // `resource` is null when the document does not exist. Pinned in
  // firestore.rules.test.mjs, "update() on a MISSING preferences doc".
  await updatePrefsWithSelfHeal(uid, mutation);
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
 * Step 7 ACCEPT 경로의 finalize. 멱등 — 완료 게이트가 이 함수의 성공을
 * 기다리므로(OnboardingScreen handleComplete), 실패로 남을 수 있는 상태를
 * 케이스별로 전부 수렴시킨다:
 *
 *   - onboardedAt 이미 timestamp: no-op 성공. 로컬 초기화(앱 데이터 삭제)
 *     후 재온보딩 케이스 — 여기서 update를 쏘면 rules의 onboardedAt
 *     immutable 룰에 걸려 사용자가 완료 화면에 영구히 갇힌다.
 *   - doc 부재: step 6 시드가 실제로는 실패했던 케이스. full seed로 복구
 *     (step 6 토글 dot-path update도 문서 부재로 다 실패했으므로 잃을
 *     것이 없다). 호출부가 넘긴 pickerSelections로 시드.
 *   - 정상(onboardedAt null): null→serverTimestamp() 단일 dot-path update.
 */
export async function finalizeOnboardingAccepted(
  uid: string,
  pickerSelections: Record<string, string[]>,
): Promise<void> {
  const existing = await getPreferences(uid);
  if (existing?.onboardedAt != null) return;
  if (!existing) {
    await seedOnboardingPreferences(uid, pickerSelections, {
      enabled: true,
      finalize: true,
    });
    return;
  }
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

const DEFAULT_PREFS: PreferencesDocument = {
  enabled: false,
  // essential은 rules invariant로 항상 true — rules의 allow create가
  // essential != true 인 문서 생성을 거부한다 (ESSENTIAL LOCK). false로
  // 두면 자가복구 create가 매번 PERMISSION_DENIED로 죽는다.
  // firestore.rules.test.mjs의 "prod mirror" 테스트가 이 shape을 create
  // 통과 기준으로 고정하고 있음 — 여기를 바꾸면 그 테스트도 함께 갱신.
  categoryEnabled: { essential: true, services: false, notices: false },
  noticeTabEnabled: {},
  pickerSelections: {},
  subscribedTopics: [],
  derivedAt: null,
  onboardedAt: null,
};

/**
 * users/{uid}/preferences/main 존재 보장 — 없으면 생성 후 시드를 반환.
 *
 * FCM 토큰·알림 권한과 무관하게 호출 가능해야 한다: 문서 부재는 picker
 * 저장(update = patch mutation, 문서 없으면 NOT_FOUND)을 조용히 죽이는
 * "유령 상태"라서, 알림을 거부한 유저에게도 복구가 돌아야 한다.
 *
 * `restore`: 로컬 MMKV에 온보딩 이력이 남은 유령 계정의 사후 구제용.
 * 사용자가 실제로 골랐던 학과 선택을 빈 문서 대신 복원한다. onboarded=true면
 * onboardedAt을 serverTimestamp로 시드 — create rule은 onboardedAt 무제약이라
 * 통과하고, 이후 리스너의 auto-restore discriminator가 정상 동작한다.
 */
export async function ensurePreferencesDoc(
  uid: string,
  restore?: { pickerSelections: Record<string, string[]>; onboarded: boolean },
): Promise<PreferencesDocument> {
  const existing = await getPreferences(uid);
  if (existing) return existing;

  const seed: PreferencesDocument = {
    ...DEFAULT_PREFS,
    ...(restore
      ? {
          pickerSelections: restore.pickerSelections,
          onboardedAt: restore.onboarded
            ? (firestore.FieldValue.serverTimestamp() as unknown)
            : null,
        }
      : {}),
  };
  // Full set with merge:false — v5 shape로 create. Rules (Phase F)는 create 시
  // subscribedTopics 빈 배열을 요구하며 DEFAULT_PREFS가 이를 만족한다.
  await primeAppCheck();
  await prefsRef(uid).set(seed);
  return seed;
}

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

  // prefs 문서 보장과 기기 등록은 의도적으로 디커플링. 과거엔 create 실패가
  // 여기서 throw → registerDevice까지 연쇄로 죽어서, 시드가 막힌 유저는
  // 푸시 기기 등록도 통째로 누락됐다. 실패는 registerDevice를 마친 뒤
  // 다시 던져 useAppInit의 withRetry 재시도 대상으로 남긴다.
  let prefsError: unknown = null;
  let finalPrefs: PreferencesDocument | null = prefsDoc;
  if (!prefsDoc) {
    try {
      finalPrefs = await ensurePreferencesDoc(uid);
    } catch (err) {
      prefsError = err;
    }
  }

  if (bootstrap.length > 0) {
    await Promise.all(bootstrap);
  }

  await registerDevice(deviceId, {
    uid,
    token,
    platform,
    appVersion,
    lastActive: new Date(), // overridden by serverTimestamp() inside registerDevice
    active: true,
    subscribedTopics: finalPrefs?.subscribedTopics ?? [],
    notificationsEnabled: finalPrefs?.enabled ?? false,
    locale: osLocale,
  });

  if (prefsError) throw prefsError;
}
