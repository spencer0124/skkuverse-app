import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from '@react-native-firebase/firestore';
import type { BookmarkEntry } from '@skkuverse/shared';
import { logHandledError } from '@/platform/crashlytics';
import { primeAppCheck } from '@/platform/app-check';

/**
 * WHY: a bookmark's cached fields only label the saved-list row; the detail always re-fetches. Writes revert
 * only on a permanent error, since the offline queue absorbs network errors on every wifi dead spot.
 */

const USERS = 'users';
const BOOKMARKS = 'bookmarks';

function bookmarkDocRef(uid: string, key: string) {
  return doc(getFirestore(), USERS, uid, BOOKMARKS, key);
}

function bookmarksColRef(uid: string) {
  return collection(getFirestore(), USERS, uid, BOOKMARKS);
}

/** WHY: `savedAt` is `serverTimestamp()`, so client clock drift never reorders the list. */
export async function saveBookmark(
  uid: string,
  key: string,
  entry: BookmarkEntry,
): Promise<void> {
  await primeAppCheck();
  await setDoc(bookmarkDocRef(uid, key), entry);
}

export async function removeBookmark(uid: string, key: string): Promise<void> {
  await primeAppCheck();
  await deleteDoc(bookmarkDocRef(uid, key));
}

/**
 * WHY: the secondary sort keeps ms-tied serverTimestamp() writes from flickering, and its composite index is
 * required; without it the listener fails with FAILED_PRECONDITION on attach.
 */
export function onBookmarksChanged(
  uid: string,
  callback: (entries: Record<string, BookmarkEntry>) => void,
  onError: (err: unknown) => void = (err) => logHandledError('bookmarks/onSnapshot', err),
): () => void {
  return onSnapshot(
    query(bookmarksColRef(uid), orderBy('savedAt', 'desc'), orderBy('articleNo', 'desc')),
    (snap) => {
      const entries: Record<string, BookmarkEntry> = {};
      snap.forEach((d) => {
        entries[d.id] = d.data() as BookmarkEntry;
      });
      callback(entries);
    },
    onError,
  );
}
