import { useEffect, useState } from 'react';
import type { PreferencesDocument } from '@skkuverse/shared';
import { onPreferencesChanged } from '@/services/firestore-notifications';

/**
 * Realtime subscription to users/{uid}/preferences/main.
 *
 * Uses a plain useState + useEffect(onSnapshot) pattern rather than React
 * Query — onSnapshot's push semantics are awkward to reconcile with
 * React Query's fetch-and-stale model, and there's only one consumer
 * (NotificationSettingsScreen in Phase 3), so the simpler hook wins.
 *
 * `prefs === null` means "not loaded yet" OR "no preferences doc exists";
 * the caller disambiguates via `loading`.
 */
export function useNotificationPreferences(uid: string | null) {
  const [prefs, setPrefs] = useState<PreferencesDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onPreferencesChanged(uid, (newPrefs) => {
      setPrefs(newPrefs);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  return { prefs, loading };
}
