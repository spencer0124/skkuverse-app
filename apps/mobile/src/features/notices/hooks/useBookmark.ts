import { useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';
import {
  authStore,
  bookmarkKey,
  classifyBookmarkToggleError,
  useBookmarkStore,
  type BookmarkEntry,
  type NoticeDetail,
} from '@skkuverse/shared';
import {
  saveBookmark,
  removeBookmark,
} from '@/services/firestore-bookmarks';
import { logBookmarkSave, logBookmarkUnsave } from '@/services/analytics';
import { logHandledError } from '@/services/crashlytics';

/**
 * Outcome of `toggle()`. The caller decides UX: auth-required → toast +
 * router.push('/login'); failed → toast `notices.saveFailed`; saved/removed
 * → no UX (the icon flip is already optimistic via the store).
 *
 * Why outcomes (not throws): toggle is fire-and-forget from the user's
 * perspective — clicking a bookmark icon is not "request a contract". Errors
 * that need UX are signaled, the rest are absorbed by the offline queue.
 */
export type ToggleOutcome = 'saved' | 'removed' | 'auth-required' | 'failed';

/**
 * Per-notice bookmark hook. Reads the saved-state for one notice from the
 * Firestore-synced Zustand store, exposes a toggle that does optimistic
 * applyLocal + server write + revert on permanent error.
 *
 * Optimistic policy:
 *   - Apply local immediately (user sees icon flip).
 *   - On permanent error (PERMISSION_DENIED, INVALID_ARGUMENT,
 *     FAILED_PRECONDITION, unauthenticated/App Check): revert + return 'failed'.
 *   - On transient error (network / queue / unknown): keep optimistic state,
 *     trust SDK offline queue + listener convergence. Return outcome as if
 *     the write succeeded — the listener will correct if it didn't.
 */
export function useBookmark(sourceId: string, articleNo: number) {
  const key = bookmarkKey(sourceId, articleNo);
  const isSaved = useBookmarkStore((s) => Boolean(s.entries[key]));

  const toggle = useCallback(
    async (notice: NoticeDetail): Promise<ToggleOutcome> => {
      const auth = authStore.getState();
      if (auth.isAnonymous || !auth.uid) return 'auth-required';
      const uid = auth.uid;

      const store = useBookmarkStore.getState();
      const priorEntry = store.entries[key] ?? null;

      if (priorEntry) {
        // Optimistic remove.
        store.applyLocal(key, null);
        try {
          await removeBookmark(uid, key);
          logBookmarkUnsave({ sourceId, articleNo });
          return 'removed';
        } catch (err) {
          if (classifyBookmarkToggleError(err) === 'permanent') {
            // Revert to the prior entry we captured.
            useBookmarkStore.getState().applyLocal(key, priorEntry);
            logHandledError('bookmarks/unsave-permanent', err);
            return 'failed';
          }
          // Transient: keep optimistic, listener will reconcile.
          return 'removed';
        }
      } else {
        // Optimistic save with cached display fields.
        const entry = buildBookmarkEntry(notice);
        store.applyLocal(key, entry);
        try {
          await saveBookmark(uid, key, entry);
          logBookmarkSave({ sourceId, articleNo });
          return 'saved';
        } catch (err) {
          if (classifyBookmarkToggleError(err) === 'permanent') {
            // Revert: remove the optimistic entry.
            useBookmarkStore.getState().applyLocal(key, null);
            logHandledError('bookmarks/save-permanent', err);
            return 'failed';
          }
          return 'saved';
        }
      }
    },
    [key, sourceId, articleNo],
  );

  return { isSaved, toggle };
}

/**
 * Build a `BookmarkEntry` from a live `NoticeDetail`. Cached display fields
 * are frozen at this moment — they're display labels only, not source of truth.
 *
 * `(notice.attachments?.length ?? 0) > 0` guards against legacy/missing-field
 * server data (older notices may lack the attachments array entirely).
 */
function buildBookmarkEntry(notice: NoticeDetail): BookmarkEntry {
  return {
    sourceId: notice.sourceId,
    articleNo: notice.articleNo,
    savedAt: firestore.FieldValue.serverTimestamp(),
    title: notice.title,
    department: notice.department,
    date: notice.date,
    sourceUrl: notice.sourceUrl,
    summaryOneLiner: notice.summary?.oneLiner ?? null,
    summaryType: notice.summary?.type ?? null,
    hasContent: Boolean(notice.contentMarkdown),
    hasAttachments: (notice.attachments?.length ?? 0) > 0,
  };
}
