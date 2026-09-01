import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
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
import { withRetry } from '@/utils/with-retry';

export type AuthFlowScope = 'login' | 'notices' | 'onboarding' | 'intro';

/**
 * Phase A+B+C of the sign-in flow shared by all 4 entrypoints (login screen,
 * notices landing "이미 가입한 적 있어요", onboarding wizard step-4, and the
 * first-launch intro's final page):
 *
 *   A. Pre-unregister the current (anon) device so the post-signin re-register
 *      can claim the doc under the new uid via Firestore rule path b
 *      ("active==false" claim). Without this the iOS anon→Google transition
 *      leaves the doc stuck under the anon uid and breaks
 *      syncPreferencesToDevices fan-out.
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
 *  - Phase A failure → log + swallow (sign-in unaffected)
 *  - Phase B failure → throw GoogleAuthError (signInWithGoogle propagates).
 *    Caller catches and maps `err.code` to scope-specific i18n key
 *    (login/notices use `auth.*`, onboarding uses `onboarding.oauth*`).
 *    google-auth.signInWithGoogle already console.errors AND calls
 *    logHandledError for DEVELOPER_ERROR / UNKNOWN paths before throwing,
 *    so no additional Crashlytics logging here — would cause duplicate
 *    recordError entries.
 *  - Phase C failure → log + swallow (sign-in already succeeded; FCM
 *    re-register is best-effort — useAppInit cold-start migration retries).
 *
 * @param scope - Crashlytics key prefix. Forms `${scope}/{pre-unregister-anon-device, post-signin-register}`.
 */
export async function signInWithDeviceMigration(
  scope: AuthFlowScope,
): Promise<FirebaseAuthTypes.User> {
  const deviceId = useNotificationStore.getState().deviceId;
  if (deviceId) {
    try {
      await unregisterDevice(deviceId);
    } catch (err) {
      logHandledError(`${scope}/pre-unregister-anon-device`, err);
    }
  }

  const result = await signInWithGoogle();
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
