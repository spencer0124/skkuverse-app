import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  signInAnonymously,
  signOut,
} from '@react-native-firebase/auth';
import {
  getFunctions,
  httpsCallable,
} from '@react-native-firebase/functions';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authStore, useSettingsStore } from '@skkuverse/shared';
import { logHandledError } from '@/services/crashlytics';

const REGION = 'asia-northeast3';

export type DeleteAccountFeedback = {
  reasons: string[];
  otherText?: string;
};

type DeleteAccountResponse = { ok: true };

/**
 * Withdraws the current Google-signed-in user.
 *
 * Server-side (Admin SDK in `deleteAccount` callable) does the heavy lifting:
 *   - records anonymous feedback (if provided)
 *   - deletes users/{uid} + preferences/main + bookmarks/*
 *   - deactivates devices owned by uid (token wipe + active:false)
 *   - deletes the Auth user
 *
 * Client steps after CF returns: revoke Google OAuth grant (must run BEFORE
 * GoogleSignin.signOut — Google's /o/oauth2/revoke endpoint requires an
 * active session), sign out, and re-anonymize so auth-gated reads keep
 * working. Then wipe user-scoped MMKV state so the onboarding gate fires
 * cleanly on the next render.
 *
 * Reuses authStore.isSigningOut to gate UI overlays the same way logout does.
 */
export async function deleteAccount(
  feedback?: DeleteAccountFeedback,
): Promise<void> {
  authStore.getState().setSigningOut(true);
  try {
    const fns = getFunctions(getApp(), REGION);
    const callable = httpsCallable<
      { feedback?: DeleteAccountFeedback },
      DeleteAccountResponse
    >(fns, 'deleteAccount');
    await callable({ feedback });

    try {
      await GoogleSignin.revokeAccess();
    } catch (err) {
      logHandledError('delete-account/revoke-access', err);
    }

    try {
      await GoogleSignin.signOut();
    } catch (err) {
      logHandledError('delete-account/google-signout', err);
    }

    try {
      await signOut(getAuth());
    } catch (err) {
      logHandledError('delete-account/firebase-signout', err);
    }

    try {
      await signInAnonymously(getAuth());
    } catch (err) {
      logHandledError('delete-account/anon-resignin', err);
      // useAppInit cold-start retry path recovers on next launch.
    }

    useSettingsStore.getState().resetUserScopedState();
  } finally {
    authStore.getState().setSigningOut(false);
  }
}
