import { useCallback, useRef } from 'react';
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
  updateBookmarkSummary,
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
  const entry = useBookmarkStore((s) => s.entries[key] ?? null);
  const isSaved = entry !== null;
  // In-flight guard for refreshSummaryIfNewlyAvailable. The detail screen
  // calls it from a useEffect on `notice` reference identity; React Query
  // background refetch (e.g. on app focus) yields a new reference even when
  // the JSON shape is stable, which would re-fire the effect before the
  // first server write resolves and the listener clears the local null.
  // Without this guard we'd issue a redundant updateDoc — same data, but a
  // wasted Firestore write per refetch.
  const refreshInFlightRef = useRef(false);

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

  /**
   * Opportunistic summary refresh. Call after the detail screen successfully
   * loads a notice. If the bookmark exists with a null cached summary AND the
   * live notice now has one, partial-update those two fields only. `savedAt`
   * is preserved (no re-stamping → no "phantom jump" in 보관함).
   *
   * Trigger: prior.summaryOneLiner === null && live one-liner non-null. We
   * tie summaryType to summaryOneLiner because the server pipeline produces
   * them together (same upstream summarizer). If that contract ever changes,
   * this trigger needs to be re-evaluated — flagged here to prevent silent
   * breakage.
   *
   * Deleted-notice case (intentional): if the original notice has been
   * removed server-side, `useNoticeDetail` resolves to error and the caller
   * never invokes this. The bookmark stays at null-summary forever, which is
   * fine under the natural-attrition policy — user either re-bookmarks or
   * leaves it as a one-line dead reference.
   */
  const refreshSummaryIfNewlyAvailable = useCallback(
    async (notice: NoticeDetail): Promise<void> => {
      if (refreshInFlightRef.current) return;
      const auth = authStore.getState();
      if (auth.isAnonymous || !auth.uid) return;
      const prior = useBookmarkStore.getState().entries[key];
      if (!prior) return;
      if (prior.summaryOneLiner !== null) return;
      const liveOneLiner = notice.summary?.oneLiner;
      const liveType = notice.summary?.type;
      if (liveOneLiner == null || liveType == null) return;

      refreshInFlightRef.current = true;
      try {
        await updateBookmarkSummary(auth.uid, key, {
          summaryOneLiner: liveOneLiner,
          summaryType: liveType,
        });
      } catch (err) {
        logHandledError('bookmarks/refresh-summary', err);
      } finally {
        refreshInFlightRef.current = false;
      }
    },
    [key],
  );

  /**
   * Remove-only bookmark mutation. Used by the deleted-notice tombstone
   * (detail screen 404 + bookmark exists) — that case has no live
   * NoticeDetail to feed `toggle()`, so this exposes a path that doesn't
   * require it. Mirrors the remove branch of `toggle()` exactly:
   * optimistic applyLocal, server delete, revert on permanent error.
   *
   * If the bookmark already isn't in the store (e.g. listener cleared it
   * mid-flight), returns 'removed' as a no-op — caller doesn't need to
   * distinguish "I removed it" from "it was already gone".
   */
  const unsave = useCallback(async (): Promise<ToggleOutcome> => {
    const auth = authStore.getState();
    if (auth.isAnonymous || !auth.uid) return 'auth-required';
    const uid = auth.uid;
    const prior = useBookmarkStore.getState().entries[key];
    if (!prior) return 'removed';

    useBookmarkStore.getState().applyLocal(key, null);
    try {
      await removeBookmark(uid, key);
      logBookmarkUnsave({ sourceId, articleNo });
      return 'removed';
    } catch (err) {
      if (classifyBookmarkToggleError(err) === 'permanent') {
        useBookmarkStore.getState().applyLocal(key, prior);
        logHandledError('bookmarks/unsave-permanent', err);
        return 'failed';
      }
      return 'removed';
    }
  }, [key, sourceId, articleNo]);

  return { isSaved, entry, toggle, unsave, refreshSummaryIfNewlyAvailable };
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
