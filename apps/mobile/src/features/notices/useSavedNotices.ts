import { useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  bookmarkKey,
  useAuthStore,
  useT,
  type BookmarkEntry,
} from '@skkuverse/shared';
import { logBookmarksListOpen } from '@/platform/analytics';
import { useBookmarks } from './useBookmarks';
import { useNoticeTabs } from './useNoticeTabs';
import type { NoticeListItem } from './notices.types';

export function useSavedNotices() {
  const { t } = useT();
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const { list } = useBookmarks();
  const { data: tabsConfig } = useNoticeTabs();

  useEffect(() => {
    logBookmarksListOpen();
  }, []);

  const items = useMemo(() => list.map(bookmarkToListItem), [list]);

  return { t, router, isAnonymous, items, tabsConfig };
}

function bookmarkToListItem(entry: BookmarkEntry): NoticeListItem {
  return {
    id: bookmarkKey(entry.sourceId, entry.articleNo),
    sourceId: entry.sourceId,
    articleNo: entry.articleNo,
    title: entry.title,
    category: null,
    author: null,
    department: entry.department,
    date: entry.date,
    sourceUrl: entry.sourceUrl,
    hasContent: entry.hasContent,
    hasAttachments: entry.hasAttachments,
    isEdited: false,
  };
}
