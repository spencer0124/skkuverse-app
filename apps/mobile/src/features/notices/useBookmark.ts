import { useCallback, useEffect, useRef } from 'react';
import { serverTimestamp } from '@react-native-firebase/firestore';
import {
  authStore,
  bookmarkKey,
  useBookmarkStore,
  type BookmarkEntry,
} from '@skkuverse/shared';
import { saveBookmark, removeBookmark } from './notices.repository';
import { logBookmarkSave, logBookmarkUnsave } from '@/platform/analytics';
import { logHandledError } from '@/platform/crashlytics';
import { DEV_ALWAYS_SHOW } from '@/features/feedback/feedback.constants';
import { classifyBookmarkToggleError } from './bookmark-errors.rules';
import type { NoticeDetail } from './notices.types';

/** WHY: outcomes, not throws: a tap is fire-and-forget, so only outcomes that need UX are signaled. */
export type ToggleOutcome = 'saved' | 'removed' | 'auth-required' | 'failed';

/** WHY: read at fire time through a ref, so a new callback from the caller never invalidates the toggle's memo. */
export interface UseBookmarkOptions {
  onReviewEligible?: (count: number) => void;
}

/**
 * WHY: a permanent error (PERMISSION_DENIED, INVALID_ARGUMENT, FAILED_PRECONDITION, auth or App Check)
 * reverts; a transient one keeps the optimistic state and trusts the offline queue and the listener.
 */
export function useBookmark(
  sourceId: string,
  articleNo: number,
  options?: UseBookmarkOptions,
) {
  const key = bookmarkKey(sourceId, articleNo);
  const entry = useBookmarkStore((s) => s.entries[key] ?? null);
  const isSaved = entry !== null;

  const optsRef = useRef<UseBookmarkOptions | undefined>(options);
  useEffect(() => {
    optsRef.current = options;
  }, [options]);

  const toggle = useCallback(
    async (notice: NoticeDetail): Promise<ToggleOutcome> => {
      const auth = authStore.getState();
      if (auth.isAnonymous || !auth.uid) return 'auth-required';
      const uid = auth.uid;

      const store = useBookmarkStore.getState();
      const priorEntry = store.entries[key] ?? null;

      if (priorEntry) {
        store.applyLocal(key, null);
        try {
          await removeBookmark(uid, key);
          logBookmarkUnsave({ sourceId, articleNo });
          return 'removed';
        } catch (err) {
          if (classifyBookmarkToggleError(err) === 'permanent') {
            useBookmarkStore.getState().applyLocal(key, priorEntry);
            logHandledError('bookmarks/unsave-permanent', err);
            return 'failed';
          }
          return 'removed';
        }
      } else {
        const entry = buildBookmarkEntry(notice);
        store.applyLocal(key, entry);
        try {
          await saveBookmark(uid, key, entry);
          logBookmarkSave({ sourceId, articleNo });
          maybeFireReviewPrompt();
          return 'saved';
        } catch (err) {
          if (classifyBookmarkToggleError(err) === 'permanent') {
            useBookmarkStore.getState().applyLocal(key, null);
            logHandledError('bookmarks/save-permanent', err);
            return 'failed';
          }
          // WHY: still a delight; the listener reconciles if the queue later rejects the write.
          maybeFireReviewPrompt();
          return 'saved';
        }
      }

      /**
       * WHY: only a new save that makes a second or later bookmark; requestAnimationFrame waits out the
       * icon flip so the sheet does not overlap the capsule transition.
       */
      function maybeFireReviewPrompt() {
        const opts = optsRef.current;
        if (!opts?.onReviewEligible) return;
        const count = Object.keys(useBookmarkStore.getState().entries).length;
        if (!DEV_ALWAYS_SHOW && count < 2) return;
        const onReviewEligible = opts.onReviewEligible;
        requestAnimationFrame(() => {
          onReviewEligible(count);
        });
      }
    },
    [key, sourceId, articleNo],
  );

  /** WHY: the tombstone has no live NoticeDetail for `toggle()`; an entry already gone is 'removed'. */
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

  return { isSaved, entry, toggle, unsave };
}

function buildBookmarkEntry(notice: NoticeDetail): BookmarkEntry {
  return {
    sourceId: notice.sourceId,
    articleNo: notice.articleNo,
    savedAt: serverTimestamp(),
    title: notice.title,
    department: notice.department,
    date: notice.date,
    sourceUrl: notice.sourceUrl,
    hasContent: Boolean(notice.contentMarkdown),
    hasAttachments: (notice.attachments?.length ?? 0) > 0,
  };
}
