import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAuth, type FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  authStore,
  useNotificationStore,
  useSettingsStore,
} from '@skkuverse/shared';
import { signInWithGoogle } from '@/services/google-auth';
import {
  ensurePreferencesDoc,
  getPreferences,
  initializeFirestoreNotifications,
  unregisterDevice,
} from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';
import { anonymousSession } from '@/services/anon-session-instance';
import { withRetry } from '@/utils/with-retry';
import { NO_PRE_UNREGISTER, startPreUnregister } from '@/services/pre-unregister';

// How long phase A may still hold things up once the sheet has closed. By then
// the write has had the student's whole time in the sheet, so this only runs
// out on a connection too slow to finish a write at all.
const PRE_UNREGISTER_SETTLE_MS = 4_000;

export type AuthFlowScope = 'login' | 'notices' | 'onboarding' | 'intro' | 'game';

/**
 * Phase A+B+C of the sign-in flow shared by all 5 entrypoints (login screen,
 * notices landing "이미 가입한 적 있어요", onboarding wizard step-4, the
 * first-launch intro's final page, and the game leaderboard prompt):
 *
 *   A. Pre-unregister the current (anon) device so the post-signin re-register
 *      can claim the doc under the new uid via Firestore rule path b
 *      ("active==false" claim). Without this the iOS anon→Google transition
 *      leaves the doc stuck under the anon uid and breaks
 *      syncPreferencesToDevices fan-out. Skipped on a device that never
 *      answered the notification prompt, since no doc can exist to claim.
 *
 *   B. Google sign-in (delegates to google-auth.signInWithGoogle which
 *      handles linkWithCredential vs signInWithCredential + domain check)
 *      followed by synchronous authStore.setAuthenticated. The manual
 *      sync is required because Android's linkWithCredential preserves the
 *      uid and does not fire onAuthStateChanged.
 *
 *   C. Synchronous re-register of the device under the post-signin uid via
 *      initializeFirestoreNotifications. iOS path: rule b claim using the
 *      pre-unregister inactive doc. Android path: re-activates the doc that
 *      was just deactivated. Both done synchronously so subsequent FCM
 *      operations don't race against useAppInit's async withRetry migration.
 *
 * Logging contract: phase A and C failures are logged via logHandledError
 * with `${scope}/${operation}` keys and swallowed (sign-in continues).
 * Callers MUST NOT add their own logHandledError for these phases — would
 * cause double-log noise in Crashlytics.
 *
 * Throw policy:
 *  - Phase A failure → log + swallow (sign-in unaffected). Phase A runs
 *    alongside the Google sheet; see pre-unregister.ts.
 *  - Phase B failure → throw GoogleAuthError (signInWithGoogle propagates).
 *    Caller catches and maps `err.code` through signInErrorMessageKey.
 *    google-auth.signInWithGoogle already records the failures worth a
 *    Crashlytics row (classifySignInError's `report`) before throwing, so
 *    neither this function nor a caller logs a GoogleAuthError again.
 *  - Phase C failure → log + swallow (sign-in already succeeded; FCM
 *    re-register is best-effort — useAppInit cold-start migration retries).
 *
 * @param scope - Crashlytics key prefix. Forms `${scope}/{pre-unregister-anon-device, pre-unregister-timeout, post-signin-register}`.
 */
export async function signInWithDeviceMigration(
  scope: AuthFlowScope,
): Promise<FirebaseAuthTypes.User> {
  const deviceId = useNotificationStore.getState().deviceId;
  // Hold the cold-start anonymous retry and let any attempt already in flight
  // land first: resolving after the Google credential, signInAnonymously
  // would replace the Google user with a fresh anonymous one. resume() in the
  // finally re-arms it only if the sign-in failed and nobody is signed in.
  await anonymousSession.pause();
  let result: FirebaseAuthTypes.UserCredential;
  let preUnregister = NO_PRE_UNREGISTER;
  try {
    // Phase A runs unless this device provably has no doc. A doc is only
    // written after the notification prompt was answered and a token fetched,
    // so the proof is every persisted signal still at its install default.
    // fcmToken alone is not enough: an APNs timeout at launch stores null over
    // a good token while the doc lives on, and skipping here would leave that
    // doc active under the anonymous uid, unclaimable by the Google one. On a
    // fresh install the unregister was a guaranteed permission-denied write
    // against a missing doc, costing a forced App Check attestation before the
    // Google sheet opened.
    //
    // Started, not awaited: see pre-unregister.ts for why it runs alongside
    // the sheet and is settled before the uid can change and before phase C.
    const { fcmToken, isTokenRegistered, permissionStatus } =
      useNotificationStore.getState();
    const mayHaveDoc =
      fcmToken !== null || isTokenRegistered || permissionStatus !== 'notDetermined';
    // Signed out entirely (the anonymous sign-in failed): the rules deny an
    // unauthenticated write, so there is nothing phase A could do.
    const signedIn = getAuth().currentUser !== null;
    preUnregister =
      deviceId && mayHaveDoc && signedIn
        ? startPreUnregister({
            run: (signal, onIssued) =>
              unregisterDevice(deviceId, signal, onIssued).catch((err) => {
                logHandledError(`${scope}/pre-unregister-anon-device`, err);
              }),
            timeoutMs: PRE_UNREGISTER_SETTLE_MS,
            // Counted: the uid is about to change with the write unsent, so
            // the doc can be left active under the old uid and phase C's claim
            // denied.
            onLandTimeout: () =>
              logHandledError(`${scope}/pre-unregister-timeout`, new Error('phase A did not land')),
          })
        : NO_PRE_UNREGISTER;

    result = await signInWithGoogle({ beforeAccountSwitch: preUnregister.landed });
    // uid kept (link): the write only has to be queued ahead of phase C's.
    await preUnregister.issued();
  } finally {
    // Failed or cancelled: a write still waiting on App Check is dropped, so
    // the device stays registered under the anonymous user it still belongs to.
    preUnregister.abort();
    anonymousSession.resume();
  }
  const user = result.user;
  authStore.getState().setAuthenticated({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  });

  // Guarantee the preferences document exists for the post-sign-in uid.
  //
  // The equivalent self-heal in useAppInit lives inside onAuthStateChanged,
  // and Android's linkWithCredential PRESERVES the uid — so that callback
  // never fires here (the reason setAuthenticated is called manually above).
  // The result was that the one path where a fresh Google account is most
  // likely to have no document was also the one path with no recovery, which
  // is how the 2026-07 picker ghost state survived its own fix.
  //
  // Deliberately OUTSIDE the `deviceId && fcmToken` gate below: during first
  // onboarding fcmToken is still null, so phase C is a no-op on exactly the
  // path that needs this. Fire-and-forget with withRetry, matching useAppInit
  // — awaiting would stall the sign-in flow for a best-effort repair.
  withRetry(() => ensurePreferencesDoc(user.uid)).catch((err) => {
    logHandledError(`${scope}/ensure-prefs`, err);
  });

  const fcmToken = useNotificationStore.getState().fcmToken;
  if (deviceId && fcmToken) {
    const lang = useSettingsStore.getState().appLanguage;
    try {
      await initializeFirestoreNotifications({
        uid: user.uid,
        deviceId,
        token: fcmToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: Constants.expoConfig?.version ?? '0.0.0',
        osLocale: lang === 'ko' ? 'ko' : 'en',
      });
    } catch (err) {
      logHandledError(`${scope}/post-signin-register`, err);
    }
  }

  return user;
}

export type OnboardingClassification =
  | { kind: 'restored' }
  | { kind: 'new' }
  | { kind: 'read-failed' };

/**
 * Phase D: read Firestore preferences/main and classify onboarding state.
 *
 * Caller-driven path — `signInWithDeviceMigration` does NOT call this.
 * Onboarding wizard step-4 intentionally skips this call (wizard always
 * seeds new prefs at step 5 via seedOnboardingPreferences).
 *
 * Side effect on `restored`: synchronously calls
 * useSettingsStore.restoreOnboardingFromRemote — gate flag
 * `onboardingCompleted` flips to true in same frame, closing the race
 * window vs useAppInit.ts:240 onPreferencesChanged listener.
 *
 * Routing decision left to caller. See plan auth-handler-unification.md
 * "Caller별 라우팅 매트릭스" section for the 3×4 matrix.
 *
 * Logging contract: prefs read failures are logged via logHandledError with
 * `${scope}/prefs-read` key. Never throws — all outcomes encoded in the
 * OnboardingClassification union. Callers do not need try/catch around
 * this function.
 *
 * Discriminator policy: onboardedAt 단독으로 판별. dept 배열은 비어 있을
 * 수도 있고 ('대표학과 스킵' 경로) 첫 자리에 sentinel ''이 있을 수도
 * 있음 (primary 스킵 + interest 선택). 둘 다 정상 시나리오.
 */
export async function classifyAndRestoreOnboarding(
  uid: string,
  scope: AuthFlowScope,
): Promise<OnboardingClassification> {
  let prefs;
  try {
    prefs = await getPreferences(uid);
  } catch (err) {
    logHandledError(`${scope}/prefs-read`, err);
    return { kind: 'read-failed' };
  }

  if (prefs?.onboardedAt != null) {
    const restoredDeptIds = prefs?.pickerSelections?.dept ?? [];
    // sentinel '' → null (primary 스킵 사용자). truthy id면 그대로.
    const restoredPrimary = restoredDeptIds[0] || null;
    const restoredInterests = restoredDeptIds.slice(1, 5);
    useSettingsStore.getState().restoreOnboardingFromRemote({
      primaryDeptId: restoredPrimary,
      interestDeptIds: restoredInterests,
    });
    return { kind: 'restored' };
  }

  return { kind: 'new' };
}
