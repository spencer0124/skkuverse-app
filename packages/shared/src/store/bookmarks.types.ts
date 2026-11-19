import type { FieldValue, Timestamp } from '@react-native-firebase/firestore';

/**
 * WHY: the display fields are labels frozen at save time; the detail screen re-fetches the live
 * notice, so drift stays in the saved-list row.
 */
export interface BookmarkEntry {
  sourceId: string;
  articleNo: number;
  savedAt: Timestamp | FieldValue;

  title: string;
  department: string | null;
  date: string;
  sourceUrl: string;
  hasContent: boolean;
  hasAttachments: boolean;
}

/** WHY: Firestore rules enforce the key's format at write time, not this encoder. */
export const bookmarkKey = (sourceId: string, articleNo: number): string =>
  `${sourceId}:${articleNo}`;

/** WHY: `lastIndexOf` keeps the trailing articleNo even if a sourceId with a colon was ever persisted. */
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
