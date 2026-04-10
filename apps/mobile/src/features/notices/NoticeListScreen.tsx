import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import {
  SdsColors,
  useNoticeDepartments,
  useNoticeList,
  useT,
} from '@skkuverse/shared';
import type { NoticeListItem, NoticeSummaryType } from '@skkuverse/shared';
import { NoticeNavBar } from './NavigationBar';
import { TypeFilterChips, type FilterValue } from './TypeFilterChips';
import { NoticeRow } from './NoticeRow';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';

interface Props {
  deptId: string;
}

export function NoticeListScreen({ deptId }: Props) {
  const router = useRouter();
  const { t } = useT();
  const [filter, setFilter] = useState<FilterValue>('all');

  const { data: depts } = useNoticeDepartments();
  const dept = useMemo(() => depts?.find((d) => d.id === deptId), [depts, deptId]);

  const queryType: NoticeSummaryType | undefined =
    filter === 'all' ? undefined : filter;

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNoticeList({ deptId, type: queryType });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.notices) ?? [],
    [data],
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

  return (
    <View style={styles.container}>
      <NoticeNavBar title={dept?.name ?? t('notices.title')} />
      <TypeFilterChips value={filter} onChange={setFilter} />

      {isLoading ? (
        <NoticeListSkeleton />
      ) : isError ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      ) : items.length === 0 ? (
        <NoticeEmptyState message={t('notices.empty')} onRetry={refetch} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NoticeRow item={item} dept={dept} onPress={handleSelect} />
          )}
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
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  footer: {
    paddingVertical: 20,
  },
});
