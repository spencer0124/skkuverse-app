import { useCallback, useMemo } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  SdsColors,
  useNoticeList,
  useSettingsStore,
  useT,
  type AppLanguage,
  type NoticeListItem,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { NoticeRow } from './NoticeRow';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { groupNoticesByDate } from './utils/groupNotices';

interface Props {
  deptId: string;
}

export function NoticeListPanel({ deptId }: Props) {
  const router = useRouter();
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage) as AppLanguage;

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNoticeList({ deptId });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.notices) ?? [],
    [data],
  );

  const sections = useMemo(
    () => groupNoticesByDate(items, lang),
    [items, lang],
  );

  const handleSelect = useCallback(
    (n: NoticeListItem) => {
      router.push(`/notices/${deptId}/${n.articleNo}` as never);
    },
    [router, deptId],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <NoticeListSkeleton />;
  if (isError) return <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />;
  if (items.length === 0) return <NoticeEmptyState message={t('notices.empty')} onRetry={refetch} />;

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => (
        <NoticeRow item={item} onPress={handleSelect} />
      )}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey600}>
            {section.title}
          </Txt>
        </View>
      )}
      SectionSeparatorComponent={({ leadingItem, trailingSection }) =>
        leadingItem && trailingSection ? (
          <View style={styles.sectionGap} />
        ) : null
      }
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.listContent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator color={SdsColors.grey500} />
          </View>
        ) : !hasNextPage && items.length > 0 ? (
          <View style={styles.endOfList}>
            <Txt typography="t7" color={SdsColors.grey500}>
              {t('notices.endOfList')}
            </Txt>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  sectionGap: {
    height: 8,
    backgroundColor: SdsColors.grey100,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F3F5',
    marginLeft: 20,
  },
  footer: {
    paddingVertical: 20,
  },
  endOfList: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
