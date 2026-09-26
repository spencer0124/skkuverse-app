import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  signOut,
  updateProfile,
  reload,
} from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { authStore } from '@skkuverse/shared';
import { getOrCreateDeviceId } from '@/services/device-id';
import { unregisterDevice } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';
import { anonymousSession } from '@/services/anon-session-instance';
import {
  GoogleAuthError,
  classifySignInError,
  shouldSignInInsteadOfLink,
} from '@/services/google-auth-errors';
import { GOOGLE_WEB_CLIENT_ID } from '../../config/constants';

const ALLOWED_DOMAIN = '@g.skku.edu';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    // Committed constant, not `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!`.
    // Metro inlines an EXPO_PUBLIC_* variable at bundle time, so an OTA publish
    // that did not carry the variable inlined `undefined` here and the non-null
    // assertion waved it through — Google Sign-In then returned idToken=null on
    // Android, the 12500 symptom recorded in `scripts/ota-release.sh`. A
    // constant cannot be absent. See `config/constants.js` for why an OAuth
    // client ID is safe in a public repo.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    hostedDomain: 'g.skku.edu',
  });
}

// ── Typed error ──────────────────────────────────────────────────────
//
// Lives in google-auth-errors.ts, native-free so node tests can load it.
// Re-exported so callers keep importing from here.

export { GoogleAuthError, signInErrorMessageKey, signInErrorCode } from '@/services/google-auth-errors';
export type { GoogleSignInErrorCode } from '@/services/google-auth-errors';

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

/**
 * @param opts.beforeAccountSwitch awaited right before a sign-in that changes
 *   the uid (the link fallback, or a switch between Google accounts):
 *   Firestore queues pending writes per uid, so anything the old user still
 *   has queued must land first.
 */
export async function signInWithGoogle(
  opts: { beforeAccountSwitch?: () => Promise<void> } = {},
) {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new GoogleAuthError('CANCELLED');
    }

    const { idToken, user: googleProfile } = response.data;

    if (!idToken) {
      throw new GoogleAuthError('UNKNOWN');
    }

    // Domain check BEFORE creating Firebase credential
    if (!googleProfile.email.endsWith(ALLOWED_DOMAIN)) {
      // Best effort: a failed revoke must not turn "SKKU accounts only" into
      // "try again", which the student would do forever. Signing out instead
      // at least keeps the account from being reused without the chooser.
      await GoogleSignin.revokeAccess().catch(() => GoogleSignin.signOut().catch(() => {}));
      throw new GoogleAuthError('DOMAIN_NOT_ALLOWED');
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);

    // Link anonymous → Google (preserves UID)
    const currentUser = getAuth().currentUser;
    let result: FirebaseAuthTypes.UserCredential;

    if (currentUser?.isAnonymous) {
      try {
        result = await linkWithCredential(currentUser, googleCredential);
      } catch (linkErr) {
        // Mostly a returning student: the Google identity already has an
        // account, and signing into it is the expected outcome, not a failure,
        // so it is no longer recorded as `google-auth/link-fallback`. The
        // anonymous user's `preferences/main` stays behind under a uid nothing
        // reads again; `devices/{id}` is reclaimed by auth-flow phase C.
        // Anything else (offline above all) is thrown — see
        // shouldSignInInsteadOfLink for why it must not fall through.
        if (!shouldSignInInsteadOfLink(linkErr)) throw linkErr;
        await opts.beforeAccountSwitch?.();
        result = await signInWithCredential(getAuth(), googleCredential);
      }
    } else {
      // Signed in with Google already (choosing another account) changes the
      // uid too. With nobody signed in there is nothing queued to wait for.
      if (currentUser) await opts.beforeAccountSwitch?.();
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
    // A GoogleAuthError thrown above passes through with its code; only a
    // missing idToken (UNKNOWN) is reported.
    const { code, report } = classifySignInError(err, statusCodes);
    if (report) logHandledError('google-auth/signin-unexpected', err);
    throw new GoogleAuthError(code);
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

    // Never rejects; a failure is logged as auth/anon-signin and retried in
    // the background. Going through the session rather than calling
    // signInAnonymously directly keeps a foreground retry from racing this
    // one into a second anonymous account.
    await anonymousSession.ensure();
  } finally {
    authStore.getState().setSigningOut(false);
  }
}
