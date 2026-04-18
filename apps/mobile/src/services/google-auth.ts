import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  signOut,
  signInAnonymously,
} from '@react-native-firebase/auth';
import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { authStore } from '@skkuverse/shared';

const ALLOWED_DOMAIN = '@g.skku.edu';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
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

// ── Sign-in ──────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new GoogleAuthError('CANCELLED');
    }

    const { idToken, user } = response.data;

    if (!idToken) {
      throw new GoogleAuthError('UNKNOWN');
    }

    // Domain check BEFORE creating Firebase credential
    if (!user.email.endsWith(ALLOWED_DOMAIN)) {
      await GoogleSignin.revokeAccess();
      throw new GoogleAuthError('DOMAIN_NOT_ALLOWED');
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);

    // Link anonymous → Google (preserves UID)
    const currentUser = getAuth().currentUser;
    if (currentUser?.isAnonymous) {
      try {
        return await linkWithCredential(currentUser, googleCredential);
      } catch (linkErr: any) {
        console.warn('[google-auth] linkWithCredential failed:', linkErr.code, linkErr.message);
        if (linkErr.code === 'auth/credential-already-in-use') {
          return await signInWithCredential(getAuth(), googleCredential);
        }
        // Fallback: try signInWithCredential instead of failing
        console.warn('[google-auth] Falling back to signInWithCredential');
        return await signInWithCredential(getAuth(), googleCredential);
      }
    }

    return await signInWithCredential(getAuth(), googleCredential);
  } catch (err) {
    if (err instanceof GoogleAuthError) throw err;
    console.error('[google-auth] Unexpected error:', err);
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleAuthError('CANCELLED');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new GoogleAuthError('PLAY_SERVICES_UNAVAILABLE');
      }
    }
    throw new GoogleAuthError('UNKNOWN');
  }
}

// ── Sign-out ─────────────────────────────────────────────────────────

export async function signOutFromGoogle() {
  authStore.getState().setSigningOut(true);
  try {
    await GoogleSignin.signOut();
    await signOut(getAuth());
    try {
      await signInAnonymously(getAuth());
    } catch (err) {
      console.warn('[google-auth] Anonymous re-sign-in failed', err);
    }
  } finally {
    authStore.getState().setSigningOut(false);
  }
}
