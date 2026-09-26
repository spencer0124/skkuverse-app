import { useEffect, useState } from 'react';
import { logHandledError } from '@/services/crashlytics';
import type { UserProfile } from './domain';
import { watchProfile } from './repository';

export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: UserProfile | null }
  | { status: 'error' };

/**
 * The signed-in player's profile, live. Live rather than fetched because the
 * setup screen is a separate route: when it closes, whoever asked for it sees
 * the answer without refetching.
 */
export function useUserProfile(uid: string | null): ProfileState {
  // Keyed by uid, so the render right after a sign-in never shows the
  // previous account's answer.
  const [state, setState] = useState<{ uid: string | null; value: ProfileState }>({
    uid: null,
    value: { status: 'ready', profile: null },
  });

  useEffect(() => {
    if (!uid) {
      setState({ uid: null, value: { status: 'ready', profile: null } });
      return;
    }
    return watchProfile(
      uid,
      (profile) => setState({ uid, value: { status: 'ready', profile } }),
      (error) => {
        logHandledError('profile/watch', error);
        setState({ uid, value: { status: 'error' } });
      },
    );
  }, [uid]);

  return state.uid === uid ? state.value : { status: 'loading' };
}
