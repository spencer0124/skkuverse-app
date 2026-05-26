import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  signOut,
  signInAnonymously,
  updateProfile,
  reload,
} from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { authStore } from '@skkuverse/shared';
import { getOrCreateDeviceId } from '@/services/device-id';
import { unregisterDevice } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';

const ALLOWED_DOMAIN = '@g.skku.edu';

// [DIAG] OTA bundle sentinel — forces hash change so eoas re-publishes after
// ota-{release,beta}.sh now-sources-.env fix. Remove with the DIAG logging cleanup.
console.log('[google-auth][DIAG] module loaded — sentinel build: 2026-05-26T1850-env-fix-verify');

export function configureGoogleSignIn() {
  const wcid = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  console.log('[google-auth][DIAG] configureGoogleSignIn() called');
  console.log('[google-auth][DIAG] webClientId present:', !!wcid, 'length:', wcid?.length ?? 0);
  console.log('[google-auth][DIAG] webClientId prefix:', wcid?.slice(0, 50));
  GoogleSignin.configure({
    webClientId: wcid!,
    // [DIAG] hostedDomain 제거 후에도 12500 발생 — 가설 기각. raw err dump으로 진단 중.
  });
  console.log('[google-auth][DIAG] GoogleSignin.configure() completed');
}

// ── Typed error ──────────────────────────────────────────────────────

export type GoogleSignInErrorCode =
  | 'DOMAIN_NOT_ALLOWED'
  | 'CANCELLED'
  | 'PLAY_SERVICES_UNAVAILABLE'
  | 'UNKNOWN';

export class GoogleAuthError extends Error {
  constructor(public code: GoogleSignInErrorCode) {
    super(code);
    this.name = 'GoogleAuthError';
  }
}

// ── Profile sync ─────────────────────────────────────────────────────
//
// linkWithCredential(anon, google) does not propagate Google's displayName /
// photoURL onto the top-level Firebase user record — only `email` is synced
// as a 1st-class identifier. Profile metadata stays in providerData[google.com]
// and the user record's displayName/photoURL remain null. We patch this by
// calling updateProfile + reload so the Auth record persists the Google
// profile fields, making them available on every subsequent onAuthStateChanged
// (incl. cold starts) without further work.

async function applyProfileUpdate(
  user: FirebaseAuthTypes.User,
  next: { displayName: string | null | undefined; photoURL: string | null | undefined },
): Promise<void> {
  const update: { displayName?: string; photoURL?: string } = {};
  if (!user.displayName && next.displayName) update.displayName = next.displayName;
  if (!user.photoURL && next.photoURL) update.photoURL = next.photoURL;
  if (Object.keys(update).length === 0) return;

  try {
    await updateProfile(user, update);
    await reload(user);
  } catch (err) {
    // Self-heal failure must not block sign-in. Next session retries.
    logHandledError('auth/sync-profile', err);
  }
}

// Fresh sign-in path — uses GoogleSignin response directly (most authoritative).
export async function syncProfileFromGoogleSignin(
  user: FirebaseAuthTypes.User,
  googleProfile: { name: string | null | undefined; photo: string | null | undefined },
): Promise<void> {
  if (user.isAnonymous) return;
  await applyProfileUpdate(user, {
    displayName: googleProfile.name,
    photoURL: googleProfile.photo,
  });
}

// Self-heal path for already-signed-in users — extracts from Firebase
// providerData. Used in useAppInit.ts onAuthStateChanged listener.
export async function syncProfileFromProviderData(
  user: FirebaseAuthTypes.User,
  providerId: string = 'google.com',
): Promise<void> {
  if (user.isAnonymous) return;
  const provider = user.providerData.find((p) => p.providerId === providerId);
  if (!provider) return;
  await applyProfileUpdate(user, {
    displayName: provider.displayName,
    photoURL: provider.photoURL,
  });
}

// ── Sign-in ──────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  console.log('[google-auth][DIAG] ========== signInWithGoogle() START ==========');
  try {
    console.log('[google-auth][DIAG] step 1: calling hasPlayServices...');
    const playServicesOK = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    console.log('[google-auth][DIAG] step 1 OK — hasPlayServices result:', playServicesOK);

    console.log('[google-auth][DIAG] step 2: calling GoogleSignin.signIn()...');
    const response = await GoogleSignin.signIn();
    console.log('[google-auth][DIAG] step 2 returned. response.type =', (response as any)?.type);
    console.log('[google-auth][DIAG] step 2 response keys:', response ? Object.keys(response).join(',') : 'null');
    try {
      console.log('[google-auth][DIAG] step 2 response full:', JSON.stringify(response, null, 2));
    } catch (jsonErr) {
      console.log('[google-auth][DIAG] step 2 response JSON.stringify failed:', String(jsonErr));
    }

    if (!isSuccessResponse(response)) {
      console.warn('[google-auth][DIAG] response is NOT success — throwing CANCELLED');
      throw new GoogleAuthError('CANCELLED');
    }

    const { idToken, user: googleProfile } = response.data;
    console.log('[google-auth][DIAG] step 3: extracted from response.data — idToken.length:', idToken?.length, 'email:', googleProfile?.email);

    if (!idToken) {
      console.warn('[google-auth][DIAG] idToken missing in success response — throwing UNKNOWN');
      throw new GoogleAuthError('UNKNOWN');
    }

    // Domain check BEFORE creating Firebase credential
    if (!googleProfile.email.endsWith(ALLOWED_DOMAIN)) {
      await GoogleSignin.revokeAccess();
      throw new GoogleAuthError('DOMAIN_NOT_ALLOWED');
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);

    // Link anonymous → Google (preserves UID)
    const currentUser = getAuth().currentUser;
    let result: FirebaseAuthTypes.UserCredential;

    if (currentUser?.isAnonymous) {
      try {
        result = await linkWithCredential(currentUser, googleCredential);
      } catch (linkErr: any) {
        console.warn('[google-auth] linkWithCredential failed:', linkErr.code, linkErr.message);
        if (linkErr.code !== 'auth/credential-already-in-use') {
          // Fallback: try signInWithCredential instead of failing
          console.warn('[google-auth] Falling back to signInWithCredential');
        }
        result = await signInWithCredential(getAuth(), googleCredential);
      }
    } else {
      result = await signInWithCredential(getAuth(), googleCredential);
    }

    // Single sync site — backfills Auth record's displayName/photoURL when
    // they're missing (always missing on link path, sometimes on signIn path).
    await syncProfileFromGoogleSignin(result.user, {
      name: googleProfile.name,
      photo: googleProfile.photo,
    });

    return result;
  } catch (err) {
    if (err instanceof GoogleAuthError) {
      console.warn('[google-auth][DIAG][CATCH] re-throwing GoogleAuthError, code:', err.code);
      throw err;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // [DIAG] RAW NATIVE ERROR DUMP — 12500 진단용. 절대 prod에서 영구화 X.
    // logcat 필터: `adb logcat | grep "google-auth\\[DIAG\\]"`
    // ═══════════════════════════════════════════════════════════════════════
    const e = err as any;
    console.error('[google-auth][DIAG][CATCH] ===== RAW ERROR DUMP START =====');
    console.error('[google-auth][DIAG][CATCH] typeof err:', typeof err);
    console.error('[google-auth][DIAG][CATCH] err.constructor.name:', e?.constructor?.name);
    console.error('[google-auth][DIAG][CATCH] err.name:', e?.name);
    console.error('[google-auth][DIAG][CATCH] err.message:', e?.message);
    console.error('[google-auth][DIAG][CATCH] err.code:', JSON.stringify(e?.code));
    console.error('[google-auth][DIAG][CATCH] err.nativeErrorCode:', JSON.stringify(e?.nativeErrorCode));
    console.error('[google-auth][DIAG][CATCH] err.domain:', JSON.stringify(e?.domain));
    console.error('[google-auth][DIAG][CATCH] err.userInfo:', JSON.stringify(e?.userInfo));
    console.error('[google-auth][DIAG][CATCH] err.nativeStackAndroid first 1KB:', e?.nativeStackAndroid?.slice?.(0, 1024));
    console.error('[google-auth][DIAG][CATCH] err.nativeStackIOS:', JSON.stringify(e?.nativeStackIOS));
    console.error('[google-auth][DIAG][CATCH] isErrorWithCode(err):', isErrorWithCode(err));
    console.error('[google-auth][DIAG][CATCH] Object.getOwnPropertyNames(err):', e ? Object.getOwnPropertyNames(e).join(',') : '(null)');
    console.error('[google-auth][DIAG][CATCH] String(err):', String(err));
    try {
      const allProps = e ? Object.getOwnPropertyNames(e) : [];
      const fullJson = JSON.stringify(err, allProps, 2);
      console.error('[google-auth][DIAG][CATCH] full JSON (own props):', fullJson);
    } catch (jsonErr) {
      console.error('[google-auth][DIAG][CATCH] JSON.stringify failed:', String(jsonErr));
    }
    console.error('[google-auth][DIAG][CATCH] err.stack first 2KB:', e?.stack?.slice?.(0, 2048));
    console.error('[google-auth][DIAG][CATCH] available statusCodes constants:', JSON.stringify(statusCodes));
    console.error('[google-auth][DIAG][CATCH] ===== RAW ERROR DUMP END =====');
    // ═══════════════════════════════════════════════════════════════════════

    if (isErrorWithCode(err)) {
      console.warn('[google-auth][DIAG] err matches isErrorWithCode — switching on err.code:', err.code);
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleAuthError('CANCELLED');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new GoogleAuthError('PLAY_SERVICES_UNAVAILABLE');
      }
      console.warn('[google-auth][DIAG] err.code did not match any statusCodes constant; falling through to UNKNOWN');
    } else {
      console.warn('[google-auth][DIAG] err does NOT match isErrorWithCode — no code/message structure');
    }

    logHandledError('google-auth/signin-unexpected', err);
    throw new GoogleAuthError('UNKNOWN');
  } finally {
    console.log('[google-auth][DIAG] ========== signInWithGoogle() END ==========');
  }
}

// ── Sign-out ─────────────────────────────────────────────────────────

export async function signOutFromGoogle() {
  authStore.getState().setSigningOut(true);
  try {
    // Task #12: deactivate the current device doc BEFORE signing out, while
    // auth.uid still matches devices/{id}.uid. This turns the sign-out
    // transition into a clean "inactive doc → new uid claims it" flow under
    // the updated Firestore rule. If this fails, the new anon uid can still
    // reclaim the doc via the relaxed rule's "resource.data.active == false"
    // branch — but only if active is already false at the time of reclaim,
    // which is why we try here first.
    try {
      const deviceId = getOrCreateDeviceId();
      await unregisterDevice(deviceId);
    } catch (err) {
      // Log but don't block sign-out — user intent trumps housekeeping.
      // The next auth transition fires the migration path as a fallback.
      logHandledError('notifications/pre-signout-unregister', err);
    }

    await GoogleSignin.signOut();
    await signOut(getAuth());

    try {
      await signInAnonymously(getAuth());
    } catch (err) {
      console.warn('[google-auth] Anonymous re-sign-in failed', err);
      logHandledError('notifications/signout-anon-resign-in', err);
      // Next app launch: useAppInit retries anon sign-in at line ~121.
    }
  } finally {
    authStore.getState().setSigningOut(false);
  }
}
