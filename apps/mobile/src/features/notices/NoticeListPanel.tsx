/**
 * Vertical notice list — single-source (`sourceId`) or multi-source
 * (`sourceIds`). Returns a `<FlatList>` as its root element so RNSScreen
 * subviews[0] is a UIScrollView (iOS 26 NativeTabs `tabBarMinimizeBehavior`
 * chain root rule). Date grouping is rendered inline as title rows in a
 * flat data array; FlatList's `stickyHeaderIndices={[0]}` pins the
 * `ListHeaderComponent` (NoticesTabStrip + optional NoticeSelector).
 *
 * Why FlatList instead of SectionList:
 *   SectionList's `stickyHeaderIndices` for ListHeaderComponent is
 *   unreliable — it conflicts with the section-sticky logic and did not
 *   pin the header in practice (verified 2026-05-05 on RN 0.81 + iOS 26;
 *   the listHeader still scrolled away). FlatList inherits
 *   `stickyHeaderIndices` directly from ScrollView and pins
 *   ListHeaderComponent dependably.
 *
 * Loading / error / empty states are rendered via `ListEmptyComponent`
 * with `contentContainerStyle.flexGrow: 1` so the FlatList stays as
 * subviews[0] during transient states (never swap to a non-ScrollView
 * root, which would break the discovery chain).
 *
 * `listHeader` prop renders inside the FlatList as its
 * `ListHeaderComponent` — pinned at the top via `stickyHeaderIndices`.
 *
 * Chain root rule background: `docs/ios-26-native-tabs-minimize.md`.
 */

import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
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

type Row =
  | { type: 'title'; text: string; key: string }
  | { type: 'item'; notice: NoticeListItem; key: string };

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

  // Flatten sections into a typed Row[]: each section becomes a title row
  // followed by its item rows. FlatList renders inline; sticky pinning
  // works reliably on FlatList's ListHeaderComponent (unlike SectionList).
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const s of sections) {
      out.push({ type: 'title', text: s.title, key: `t-${s.key}` });
      for (const n of s.data) {
        out.push({ type: 'item', notice: n, key: n.id });
      }
    }
    return out;
  }, [sections]);

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

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === 'title') {
        return (
          <View style={styles.sectionHeader}>
            <Txt
              typography="t7"
              fontWeight="semiBold"
              color={SdsColors.grey600}
            >
              {item.text}
            </Txt>
          </View>
        );
      }
      return (
        <NoticeRow
          item={item.notice}
          onPress={handleSelect}
          showDepartment={multi}
          highlightQuery={q}
        />
      );
    },
    [handleSelect, multi, q],
  );

  // Type-aware separator: 1pt divider between consecutive items, 8pt grey
  // section gap when an item is followed by the next section's title.
  // title → item needs no separator (the title already carries top
  // padding). Title rows don't follow other titles in our flattening.
  const renderSeparator = useCallback(
    ({
      leadingItem,
      trailingItem,
    }: {
      leadingItem?: Row;
      trailingItem?: Row;
    }) => {
      if (!leadingItem || !trailingItem) return null;
      if (leadingItem.type === 'item' && trailingItem.type === 'item') {
        return <View style={styles.divider} />;
      }
      if (leadingItem.type === 'item' && trailingItem.type === 'title') {
        return <View style={styles.sectionGap} />;
      }
      return null;
    },
    [],
  );

  // FlatList must be the root element on every render so that the
  // RNSScrollViewFinder strict subviews[0] chain (RN-screens 4.19,
  // RNSScrollViewFinder.mm:5-20) reaches a UIScrollView at the screen's
  // initial mount — required for iOS 26 NativeTabs minimizeBehavior. The
  // native finder runs once via mountChildComponentView(index==0); JS-level
  // conditional swaps below the screen root won't re-trigger it. Loading /
  // error / empty states are therefore rendered through ListEmptyComponent
  // and contentContainerStyle.flexGrow=1 to fill the visible area.
  const isEmpty = rows.length === 0;
  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(r) => r.key}
      renderItem={renderItem}
      ItemSeparatorComponent={renderSeparator}
      // Pin listHeader (NoticesTabStrip + optional NoticeSelector) at the
      // top so the 9-tab fluid + dept dropdown stay visible while only the
      // notice rows scroll. Index 0 because ListHeaderComponent is at the
      // first flat-render position. Compatible with iOS 26 NativeTabs
      // minimize-on-scroll: stickiness is internal layout, the underlying
      // UIScrollView contentOffset still changes so the system gesture
      // recognizer triggers tabBarMinimizeBehavior normally. RNSScreen
      // subviews[0] is still this FlatList (chain root rule).
      stickyHeaderIndices={[0]}
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
