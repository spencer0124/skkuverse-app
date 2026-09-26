import { logHandledError } from '@/services/crashlytics';
import type { UserProfile } from './domain';
import { pendingProfileSetup } from './pendingSetup';
import { getProfile, getProfileFromServer, saveProfile } from './repository';

/**
 * After a Google sign-in outside the notices wizard: a player with no profile
 * is asked for their campus once the app is on screen. Fire and forget — a failed read asks nothing, and the leaderboard
 * gate asks later.
 */
export function requestProfileSetupIfMissing(uid: string): void {
  getProfile(uid)
    .then((profile) => {
      if (!profile) pendingProfileSetup.set();
    })
    .catch((err) => logHandledError('profile/check-after-signin', err));
}

/**
 * The notices wizard has just asked the campus; a player without a profile
 * gets it as theirs. An existing profile is never overwritten — it
 * may be carrying a nickname and entries, and changing it is the profile
 * screen's job. Fire and forget: offline, it does nothing, and the
 * leaderboard gate asks later.
 */
export function fillProfileIfMissing(uid: string, answers: Pick<UserProfile, 'campus'>): void {
  // The server's answer only: an empty offline cache must not pass for "no
  // profile" and overwrite one another device saved.
  getProfileFromServer(uid)
    .then((profile) => (profile ? undefined : saveProfile(uid, answers)))
    .catch((err) => logHandledError('profile/fill-from-onboarding', err));
}
