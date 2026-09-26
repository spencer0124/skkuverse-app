import { getAuth, signInAnonymously } from '@react-native-firebase/auth';
import { logHandledError } from '@/services/crashlytics';
import { createAnonymousSession } from '@/services/anon-session';

/**
 * The app's one anonymous-session scheduler. The logic and its reasoning live
 * in `anon-session.ts`; this file only wires Firebase and Crashlytics into it.
 *
 * `auth/anon-signin` is the only trace a failed cold-start sign-in leaves —
 * before this module it left none at all. Logged once per process so a device
 * stuck behind an exhausted quota does not emit one event per retry.
 */
export const anonymousSession = createAnonymousSession({
  hasUser: () => getAuth().currentUser !== null,
  signIn: () => signInAnonymously(getAuth()),
  onFirstFailure: (err) => logHandledError('auth/anon-signin', err),
  // How long a caller waits before moving on signed out. On a cold start this
  // is splash time; the attempt itself keeps running past it.
  timeoutMs: 8_000,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  random: Math.random,
});
