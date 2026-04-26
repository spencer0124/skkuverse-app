import { useEffect, useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  SdsColors,
  bookmarkKey,
  useAuthStore,
  useSettingsStore,
  useT,
  type AppLanguage,
  type BookmarkEntry,
  type NoticeListItem,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { NoticeRow } from '@/features/notices/NoticeRow';
import { NoticeEmptyState } from '@/features/notices/EmptyState';
import { NoticeLoginGate } from '@/features/notices/components/NoticeLoginGate';
import { groupNoticesByDate } from '@/features/notices/utils/groupNotices';
import { useBookmarks } from '@/features/notices/hooks/useBookmarks';
import { logBookmarksListOpen } from '@/services/analytics';

/**
 * Saved notices list screen — `/notices/saved`.
 *
 * Renders the user's bookmark collection (from the Firestore-synced Zustand
 * store) using the same NoticeRow + section grouping the main notices tab
 * uses. Cached display fields on each BookmarkEntry are sufficient — the
 * notice detail screen re-fetches live data on tap.
 *
 * Auth gate: anonymous users hit NoticeLoginGate (mirrors NoticesTabScreen).
 * Without this, an anonymous user landing here via deep link or back-stack
 * shenanigans would see an empty list with no explanation.
 *
 * Privacy: useAppInit's auth listener calls `useBookmarkStore.clearEntries()`
 * on sign-out, so the next anon user on a shared device sees an empty list
 * (which the gate then replaces with the login CTA), not the prior owner's
 * bookmarks.
 */
export default function SavedNoticesScreen() {
  const { t } = useT();
  const router = useRouter();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const lang = useSettingsStore((s) => s.appLanguage) as AppLanguage;
  const { list } = useBookmarks();

  useEffect(() => {
    logBookmarksListOpen();
  }, []);

  const sections = useMemo(() => {
    const items = list.map(bookmarkToListItem);
    return groupNoticesByDate(items, lang);
  }, [list, lang]);

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
      <SectionList
        style={styles.list}
        sections={sections}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NoticeRow
            item={item}
            onPress={(n) =>
              router.push(`/notices/${n.sourceId}/${n.articleNo}` as never)
            }
            showDepartment
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey500}>
              {section.title}
            </Txt>
          </View>
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
 * NoticeRow's deadline-pill renderer would treat empty fields as "active
 * deadline today" and mis-pill the row. Better to render no pill than a
 * wrong one.
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
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: SdsColors.background,
  },
});
