import { useMemo } from 'react';
import { useBookmarkStore, type BookmarkEntry } from '@skkuverse/shared';

/**
 * List view of all bookmarks for the current user, sorted newest-first.
 *
 * Sort: `savedAt` desc → `articleNo` desc tiebreaker. Mirrors the Firestore
 * listener query order (composite index in firestore.indexes.json), so the
 * client-side sort is just a re-confirmation — it stays correct even if the
 * store is mutated optimistically (which inserts/removes entries without
 * touching the listener's snapshot order).
 *
 * Returns `loaded` so the saved-list screen can distinguish "not yet hydrated"
 * (skeleton) from "actually empty" (empty state).
 */
export function useBookmarks(): { list: BookmarkEntry[]; loaded: boolean } {
  const entries = useBookmarkStore((s) => s.entries);
  const loaded = useBookmarkStore((s) => s.loaded);

  const list = useMemo(() => Object.values(entries).sort(compareEntries), [entries]);

  return { list, loaded };
}

function compareEntries(a: BookmarkEntry, b: BookmarkEntry): number {
  const aMs = toMillis(a.savedAt);
  const bMs = toMillis(b.savedAt);
  if (aMs !== bMs) return bMs - aMs; // savedAt desc
  return b.articleNo - a.articleNo; // articleNo desc tiebreaker
}

/**
 * `BookmarkEntry.savedAt` may be a Firestore Timestamp (read from listener)
 * or a sentinel FieldValue (right after a local optimistic write before the
 * listener echoes back the server value). Optimistic writes pass through
 * `serverTimestamp()` which has no client timestamp; for sort ordering we
 * place such entries at the top (Number.MAX_SAFE_INTEGER) — matches the
 * "newest-first" intuition, and resolves to a real Timestamp within ~1s.
 */
function toMillis(savedAt: BookmarkEntry['savedAt']): number {
  if (savedAt && typeof savedAt === 'object' && 'toMillis' in savedAt) {
    return (savedAt as { toMillis: () => number }).toMillis();
  }
  return Number.MAX_SAFE_INTEGER;
}
