import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import type { BookmarkEntry, BookmarkSummaryType } from '@skkuverse/shared';
import { logHandledError } from '@/services/crashlytics';
import { primeAppCheck } from '@/services/app-check-prime';

/**
 * Firestore service for the notice bookmark subsystem (Phase 1 Chunk A).
 *
 * Path: `users/{uid}/bookmarks/{key}`  where  key = `${sourceId}:${articleNo}`.
 *
 * The cached display fields on `BookmarkEntry` (title, department, date,
 * sourceUrl, summaryOneLiner, summaryType, hasContent, hasAttachments) are
 * **display labels for the saved-list row only — never source of truth**. The
 * notice detail screen always re-fetches the live notice on tap, so any drift
 * (title edit, deletion) is bounded to the saved-list row's appearance and
 * cleared on the next visit.
 *
 * Pattern mirrors `firestore-notifications.ts`:
 *   - `primeAppCheck()` before every write to avoid the stale-token bug
 *     (PERMISSION_DENIED on server while local cache accepts).
 *   - `onSnapshot` listener returns its unsubscribe function so `useAppInit`
 *     can attach/detach on uid transitions and clear on sign-out.
 *
 * Bookmark-specific notes:
 *   - Reads use the SDK's disk persistence on cold start (no MMKV mirror).
 *   - The listener query orders by (savedAt desc, articleNo desc); the
 *     `(savedAt desc, articleNo desc)` composite index is declared in
 *     `firestore.indexes.json` and is required — without it the listener
 *     fails with FAILED_PRECONDITION on attach.
 *   - Toggle UX should be optimistic via `useBookmarkStore.applyLocal`, with
 *     revert ONLY on permanent error (PERMISSION_DENIED, INVALID_ARGUMENT,
 *     FAILED_PRECONDITION, App Check failure). Network errors are absorbed
 *     by the SDK's offline queue; surfacing them as rollbacks would create
 *     noisy UX on every campus-wifi dead spot.
 */

const USERS = 'users';
const BOOKMARKS = 'bookmarks';

function bookmarkDocRef(uid: string, key: string) {
  return firestore()
    .collection(USERS)
    .doc(uid)
    .collection(BOOKMARKS)
    .doc(key);
}

function bookmarksColRef(uid: string) {
  return firestore().collection(USERS).doc(uid).collection(BOOKMARKS);
}

// ── Writes ───────────────────────────────────────────────────────

/**
 * Save a bookmark. Uses `setDoc` (atomic upsert) — first save creates the doc,
 * subsequent saves overwrite it (re-saving an already-saved notice refreshes
 * the cached display fields with the latest title/department/etc).
 *
 * Caller should set `entry.savedAt` to `firestore.FieldValue.serverTimestamp()`
 * so server-clock skew doesn't fight client clock drift in the list ordering.
 */
export async function saveBookmark(
  uid: string,
  key: string,
  entry: BookmarkEntry,
): Promise<void> {
  await primeAppCheck();
  await bookmarkDocRef(uid, key).set(entry);
}

/** Remove a bookmark. Idempotent — deleting a non-existent doc is a no-op. */
export async function removeBookmark(uid: string, key: string): Promise<void> {
  await primeAppCheck();
  await bookmarkDocRef(uid, key).delete();
}

/**
 * Partial update of just the summary cache fields. Used by the detail-screen
 * opportunistic refresh when a previously-null summary becomes available
 * server-side after the user already bookmarked the notice.
 *
 * CRITICAL: do NOT use saveBookmark() / setDoc() here — that would re-stamp
 * `savedAt: serverTimestamp()`, bumping the bookmark to the top of the list
 * and breaking the user's "save order" mental model. updateDoc() merges, so
 * the existing savedAt Timestamp is preserved.
 *
 * Type: signature intentionally non-null. This function fills the summary;
 * it does not erase one. If a "clear summary" use case ever appears, write
 * a separate function — don't relax this signature, the compile-time guard
 * is the whole point.
 *
 * Rules compatibility (firestore.rules:81-89): `request.resource.data` in an
 * update is the merged post-write doc; pre-existing fields (sourceId,
 * articleNo, title, savedAt) survive the merge and satisfy the type/identity
 * checks. Locked by tests in firestore.rules.test.mjs covering the partial-
 * update path (one allow, one identity-tamper deny).
 */
export async function updateBookmarkSummary(
  uid: string,
  key: string,
  patch: { summaryOneLiner: string; summaryType: BookmarkSummaryType },
): Promise<void> {
  await primeAppCheck();
  await bookmarkDocRef(uid, key).update(patch);
}

// ── Realtime subscription ────────────────────────────────────────

/**
 * Subscribe to the user's bookmark collection. Returns an unsubscribe function.
 *
 * Snapshot delivers the entries as a `Record<string, BookmarkEntry>` keyed by
 * the document ID (the bookmarkKey) — caller can pass the result directly to
 * `useBookmarkStore.setEntries`.
 *
 * Ordered by (savedAt desc, articleNo desc). The secondary sort prevents
 * flicker on ms-tied serverTimestamp() writes — composite index required.
 */
export function onBookmarksChanged(
  uid: string,
  callback: (entries: Record<string, BookmarkEntry>) => void,
): () => void {
  return bookmarksColRef(uid)
    .orderBy('savedAt', 'desc')
    .orderBy('articleNo', 'desc')
    .onSnapshot(
      (snap: FirebaseFirestoreTypes.QuerySnapshot) => {
        const entries: Record<string, BookmarkEntry> = {};
        snap.forEach((doc) => {
          entries[doc.id] = doc.data() as BookmarkEntry;
        });
        callback(entries);
      },
      (err) => {
        logHandledError('bookmarks/onSnapshot', err);
      },
    );
}
