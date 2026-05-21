/**
 * Notice bookmark — types + key codec.
 *
 * Subcollection model: `users/{uid}/bookmarks/{key}` where `key` is built by
 * `bookmarkKey(sourceId, articleNo)`. The colon separator is allowed in
 * Firestore document IDs and in field names, and `(sourceId, articleNo)` is
 * the canonical notice identity tuple already used by every layer (crawler /
 * server unique index / mobile route / homepage AASA path).
 *
 * The cached display fields on `BookmarkEntry` are display labels only — they
 * are *not* the source of truth. The notice detail screen always re-fetches
 * the live notice on tap, so any drift (title edit, deletion) is bounded to
 * the saved-list row's appearance.
 */

import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type BookmarkSummaryType = 'action_required' | 'event' | 'informational';

/**
 * Single bookmark document — stored at `users/{uid}/bookmarks/{key}`.
 *
 * Identity: (sourceId, articleNo). Cached display fields below are frozen at
 * save time; refreshed only when the user re-saves an already-saved notice.
 */
export interface BookmarkEntry {
  // ── Identity (required, validated by Firestore Rules) ──
  sourceId: string;
  articleNo: number;
  savedAt: FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue;

  // ── Cached display fields (display labels only, NOT source of truth) ──
  title: string;
  department: string | null;
  date: string; // YYYY-MM-DD
  sourceUrl: string;
  summaryOneLiner: string | null;
  summaryType: BookmarkSummaryType | null;
  hasContent: boolean; // parity with NoticeRow affordance
  hasAttachments: boolean; // parity with NoticeRow affordance
}

/**
 * Encode `(sourceId, articleNo)` to a Firestore document ID.
 *
 * Caller is expected to pass a kebab-case sourceId and a positive integer
 * articleNo — the format is enforced by Firestore Rules at write time, not
 * by this encoder. The decoder `parseBookmarkKey` performs structural
 * validation (positive integer, non-empty sourceId).
 */
export const bookmarkKey = (sourceId: string, articleNo: number): string =>
  `${sourceId}:${articleNo}`;

/**
 * Decode a bookmark key back into `(sourceId, articleNo)`.
 *
 * Returns null for malformed input:
 *   - empty string
 *   - missing colon separator
 *   - empty sourceId (leading colon)
 *   - empty / non-numeric / non-integer / non-positive articleNo
 *
 * Uses `lastIndexOf(':')` so that even if a malformed sourceId containing a
 * colon was somehow persisted, the parser still extracts the trailing
 * articleNo correctly. (The Rules-level regex `^[a-z0-9-]+$` on sourceId
 * prevents this from happening server-side.)
 */
export const parseBookmarkKey = (
  key: string,
): { sourceId: string; articleNo: number } | null => {
  const idx = key.lastIndexOf(':');
  if (idx <= 0) return null;
  const tail = key.slice(idx + 1);
  if (tail === '') return null;
  const articleNo = Number(tail);
  if (!Number.isInteger(articleNo) || articleNo <= 0) return null;
  return { sourceId: key.slice(0, idx), articleNo };
};
