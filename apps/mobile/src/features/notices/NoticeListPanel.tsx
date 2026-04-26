/**
 * Vertical notice list — single-source (`sourceId`) or multi-source
 * (`sourceIds`). Always returns a `<SectionList>` as its root element so
 * RNSScreen subviews[0] is a UIScrollView and iOS 26 NativeTabs
 * `tabBarMinimizeBehavior` discovers it at native mount time. Loading /
 * error / empty states are rendered via `ListEmptyComponent` with
 * `contentContainerStyle.flexGrow: 1` to fill the visible area — never as
 * a non-ScrollView root, which would break the discovery chain.
 *
 * `listHeader` prop renders inside the SectionList as its
 * `ListHeaderComponent` — used by NoticesTabScreen to embed the picker
 * selector inside the list (rather than as an absolute overlay) so it is
 * guaranteed to mount and remain visible. The header scrolls with the
 * list rather than staying pinned; if a sticky variant is needed later,
 * use SectionList's stickyHeader pattern explicitly.
 *
 * Chain root rule background: `docs/ios-26-native-tabs-minimize.md`.
 */

import type { ReactElement } from 'react';
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
  useMultiSourceNoticeList,
  useSettingsStore,
  useT,
  type AppLanguage,
  type NoticeListItem,
  type NoticePage,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { NoticeRow } from './NoticeRow';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { groupNoticesByDate } from './utils/groupNotices';

type Props = (
  | { sourceId: string; sourceIds?: never }
  | { sourceId?: never; sourceIds: string[] }
) & {
  listHeader?: ReactElement;
  /** Optional search query — forwarded to the data hook (server applies
   *  case-insensitive regex on title + summaryOneLiner) and to NoticeRow
   *  as `highlightQuery` so each row visually marks the matched
   *  substring. Empty / undefined preserves existing behavior. */
  q?: string;
};

export function NoticeListPanel(props: Props) {
  const multi = 'sourceIds' in props && props.sourceIds != null;
  const listHeader = props.listHeader;
  const q = props.q;
  const router = useRouter();
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage) as AppLanguage;

  const singleResult = useNoticeList({
    sourceId: multi ? '' : props.sourceId!,
    q,
    enabled: !multi,
  });
  const multiResult = useMultiSourceNoticeList({
    sourceIds: multi ? props.sourceIds! : [],
    q,
    enabled: multi,
  });

  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = multi ? multiResult : singleResult;

  const items = useMemo(
    () => data?.pages.flatMap((p: NoticePage) => p.notices) ?? [],
    [data],
  );

  const sections = useMemo(
    () => groupNoticesByDate(items, lang),
    [items, lang],
  );

  const navSourceId = multi ? undefined : props.sourceId;
  const handleSelect = useCallback(
    (n: NoticeListItem) => {
      router.push(`/notices/${navSourceId ?? n.sourceId}/${n.articleNo}` as never);
    },
    [router, navSourceId],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // SectionList must be the root element on every render so that the
  // RNSScrollViewFinder strict subviews[0] chain (RN-screens 4.19,
  // RNSScrollViewFinder.mm:5-20) reaches a UIScrollView at the screen's
  // initial mount — required for iOS 26 NativeTabs minimizeBehavior. The
  // native finder runs once via mountChildComponentView(index==0); JS-level
  // conditional swaps below the screen root won't re-trigger it. Loading /
  // error / empty states are therefore rendered through ListEmptyComponent
  // and contentContainerStyle.flexGrow=1 to fill the visible area.
  const isEmpty = sections.length === 0;
  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => (
        <NoticeRow
          item={item}
          onPress={handleSelect}
          showDepartment={multi}
          highlightQuery={q}
        />
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
      ListHeaderComponent={listHeader}
      contentContainerStyle={[
        styles.listContent,
        isEmpty ? styles.emptyContent : null,
      ]}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      ListEmptyComponent={
        isLoading ? (
          <NoticeListSkeleton />
        ) : isError ? (
          <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
        ) : q && q.length > 0 ? (
          <NoticeEmptyState message={t('notices.search.empty.subtitle')} />
        ) : (
          <NoticeEmptyState message={t('notices.empty')} onRetry={refetch} />
        )
      }
      ListFooterComponent={
        isEmpty ? null : isFetchingNextPage ? (
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
  emptyContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    paddingTop: 28,
    paddingBottom: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  sectionGap: {
    height: 8,
    backgroundColor: SdsColors.grey100,
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F3F5',
    marginLeft: 24,
  },
  footer: {
    paddingVertical: 20,
  },
  endOfList: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
