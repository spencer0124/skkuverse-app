import { useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  SdsColors,
  bookmarkKey,
  useAuthStore,
  useT,
  type BookmarkEntry,
  type NoticeListItem,
} from '@skkuverse/shared';
import { NoticeRow } from '@/features/notices/NoticeRow';
import { NoticeEmptyState } from '@/features/notices/EmptyState';
import { NoticeLoginGate } from '@/features/notices/components/NoticeLoginGate';
import { useBookmarks } from '@/features/notices/hooks/useBookmarks';
import { logBookmarksListOpen, logNoticesContentSelect } from '@/services/analytics';

/**
 * Saved notices list screen — `/notices/saved`.
 *
 * Renders the user's bookmark collection (from the Firestore-synced Zustand
 * store) as a flat reverse-chronological list ordered by `savedAt`. The
 * notices tab uses `groupNoticesByDate` to bucket by article-publish date;
 * a personal save list shouldn't — that bucketing scrambles the user's
 * "newest-saved" mental model (Pocket / Twitter Bookmarks / Apple Reading
 * List all use flat reverse-chronological for the same reason).
 *
 * Auth gate: anonymous users hit NoticeLoginGate (mirrors NoticesTabScreen).
 *
 * Privacy: useAppInit's auth listener calls `useBookmarkStore.clearEntries()`
 * on sign-out, so the next anon user on a shared device sees an empty list
 * (which the gate replaces with the login CTA), not the prior owner's
 * bookmarks.
 */
export default function SavedNoticesScreen() {
  const { t } = useT();
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const { list } = useBookmarks();

  useEffect(() => {
    logBookmarksListOpen();
  }, []);

  const items = useMemo(() => list.map(bookmarkToListItem), [list]);

  if (isAnonymous) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('notices.saved') }} />
        <NoticeLoginGate
          description={t('notices.authRequired')}
          onLoginPress={() => router.push('/login')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('notices.saved') }} />
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NoticeRow
            item={item}
            onPress={(n) => {
              logNoticesContentSelect({
                content_type: 'list_row',
                item_id: `${n.sourceId}/${n.articleNo}`,
              });
              router.push(`/notices/${n.sourceId}/${n.articleNo}` as never);
            }}
            showDepartment
          />
        )}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={
          <NoticeEmptyState
            message={t('notices.savedEmpty')}
          />
        }
      />
    </View>
  );
}

/**
 * Adapt a `BookmarkEntry` into the `NoticeListItem` shape `NoticeRow` expects.
 * Cached fields fill what we have; everything else defaults safely (category,
 * author, views, isEdited). The synthesized `id` uses the bookmarkKey so
 * SectionList keyExtractor stays stable across re-renders.
 *
 * Summary is synthesized only when we cached a `summaryType` — without it
 * NoticeRow's deadline formatter would treat empty fields as "active
 * deadline today" and prepend a wrong D-day to the summary line. Better to
 * render no deadline than a wrong one.
 */
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
    views: 0,
    sourceUrl: entry.sourceUrl,
    hasContent: entry.hasContent,
    hasAttachments: entry.hasAttachments,
    isEdited: false,
    summary: entry.summaryType
      ? {
          oneLiner: entry.summaryOneLiner,
          type: entry.summaryType,
          startAt: null,
          endAt: null,
        }
      : null,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  list: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
