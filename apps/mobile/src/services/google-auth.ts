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
import { GOOGLE_WEB_CLIENT_ID } from '../../config/constants';

const ALLOWED_DOMAIN = '@g.skku.edu';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    // A committed constant rather than `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
    // Metro INLINES an EXPO_PUBLIC_* value at bundle time, so an OTA published
    // from a shell whose `.env` does not carry it ships `undefined` here and
    // Google Sign-In fails for every user who takes the update — silently, and
    // only at the moment somebody tries to sign in. An OAuth client ID is
    // public by design (it travels in the authorisation request itself), so
    // committing it leaks nothing; see config/constants.js.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    hostedDomain: 'g.skku.edu',
  });
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
    if (err instanceof GoogleAuthError) throw err;
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleAuthError('CANCELLED');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new GoogleAuthError('PLAY_SERVICES_UNAVAILABLE');
      }
    }
    logHandledError('google-auth/signin-unexpected', err);
    throw new GoogleAuthError('UNKNOWN');
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
