/**
 * Vertical notice list — single-source (`sourceId`) or multi-source
 * (`sourceIds`). Returns a `<FlatList>` as the Fragment's first child so
 * RNSScreen subviews[0] is a UIScrollView (iOS 26 NativeTabs
 * `tabBarMinimizeBehavior` chain root rule).
 *
 * Architecture — chrome OUTSIDE the FlatList:
 *   The 9-tab strip + optional dept selector (passed via `listHeader`
 *   prop) is rendered as an absolute-positioned `<View>` Fragment-sibling
 *   AFTER the FlatList. The FlatList itself uses `style.marginTop =
 *   chromeHeight` so its underlying UIScrollView starts at viewport y =
 *   chromeHeight. iOS native `<RefreshControl>` then auto-positions its
 *   indicator at the FlatList's top edge (= just below the chrome
 *   overlay) — exactly the user-requested "pull-to-refresh below the
 *   chrome" visual.
 *
 * Why not `stickyHeaderIndices` / `Animated.View` listHeader:
 *   - `Animated.View` + `stickyHeaderIndices` throws
 *     `throwOnImmutableMutation` on iOS in Expo SDK 54
 *     (software-mansion/react-native-reanimated#8284).
 *   - iOS UIRefreshControl ignores `progressViewOffset` (Android-only in
 *     practice; facebook/react-native#54183 is the current iOS regression
 *     of PR #30737's earlier fix).
 *   - With sticky listHeader, the strip rubber-bands with content during
 *     pull and the refresh indicator overlaps it — the very symptom the
 *     user reported.
 *
 * Why FlatList style.marginTop preserves chain root:
 *   `style` propagates to the underlying ScrollView (RN doesn't insert a
 *   wrapping View). The native UIScrollView has the margin applied
 *   directly — still subviews[0] of RNSScreen, still a UIScrollView, so
 *   the chain finder reaches it on first `mountChildComponentView`.
 *
 * Trade-off: pull-down on the chrome area itself does NOT trigger
 *   refresh (chrome is outside the scroll view). User must pull from the
 *   notice-row area. Acceptable per requirements (chrome stays visible
 *   while scrolling; no shared scroll mechanics needed).
 *
 * Loading / error / empty states render via `ListEmptyComponent` with
 * `contentContainerStyle.flexGrow: 1`. FlatList stays as Fragment first
 * child during transient states (no non-ScrollView root swap).
 *
 * Chain root rule background: `docs/explanation/ios-26-native-tabs-minimize.md`.
 */

import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  SdsColors,
  useNoticeList,
  useMultiSourceNoticeList,
  useT,
  type NoticeListItem,
  type NoticePage,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { NoticeRow } from './NoticeRow';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { logNoticesContentSelect } from '@/services/analytics';

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

/**
 * The list is deliberately ungrouped — no date section headers, no month
 * dividers, just one continuous run of notices. That makes it homogeneous,
 * so the separator is a constant: every gap is the same hairline and
 * `ItemSeparatorComponent` needs no knowledge of its neighbours.
 *
 * (Worth remembering if grouping ever returns: FlatList's separator only
 * receives `{highlighted, leadingItem}` — `trailingItem` is injected
 * exclusively by VirtualizedSectionList, so a FlatList separator cannot
 * see what follows it and any "which kind of gap" decision has to be
 * precomputed onto the row during flattening.)
 */
function RowDivider() {
  return <View style={styles.divider} />;
}

// First-frame estimate so chrome doesn't briefly overlap the first notice
// row before onLayout settles. 94pt covers the picker case (NoticesTabStrip
// ~44 + NoticeSelector ~50); fixed tabs measure ~44 and the marginTop
// shrinks on the next frame. Overestimate is safer than under (extra empty
// space briefly is less jarring than chrome covering content).
const ESTIMATED_CHROME_HEIGHT = 94;

export function NoticeListPanel(props: Props) {
  const multi = 'sourceIds' in props && props.sourceIds != null;
  const listHeader = props.listHeader;
  const q = props.q;
  const router = useRouter();
  const { t } = useT();

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

  const navSourceId = multi ? undefined : props.sourceId;
  const handleSelect = useCallback(
    (n: NoticeListItem) => {
      logNoticesContentSelect({
        content_type: 'list_row',
        item_id: `${navSourceId ?? n.sourceId}/${n.articleNo}`,
      });
      router.push(`/notices/${navSourceId ?? n.sourceId}/${n.articleNo}` as never);
    },
    [router, navSourceId],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: NoticeListItem }) => (
      <NoticeRow
        item={item}
        onPress={handleSelect}
        showDepartment={multi}
        highlightQuery={q}
      />
    ),
    [handleSelect, multi, q],
  );

  // Measure the chrome overlay so the FlatList's marginTop matches it
  // exactly. Initial estimate covers picker tabs; onLayout corrects on the
  // next frame for fixed tabs (NoticesTabStrip alone, no selector).
  const [chromeHeight, setChromeHeight] = useState(ESTIMATED_CHROME_HEIGHT);
  const onChromeLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0 && next !== chromeHeight) setChromeHeight(next);
  }, [chromeHeight]);

  const isEmpty = items.length === 0;
  return (
    <>
      <FlatList
        style={[styles.list, { marginTop: chromeHeight }]}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        ItemSeparatorComponent={RowDivider}
        contentContainerStyle={[
          styles.listContent,
          isEmpty ? styles.emptyContent : null,
        ]}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        // Native iOS / Android RefreshControl. Indicator auto-positions at
        // the UIScrollView's top edge — which is `marginTop` below the
        // chrome overlay above, so the spinner appears just below the
        // chrome during pull. No JS-side offset needed.
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
      {/* Chrome overlay — Fragment-sibling AFTER the FlatList so subviews[0]
          remains the UIScrollView (chain root rule). pointerEvents="box-none"
          lets taps pass through this wrapper while children (Tab strip,
          NoticeSelector pressable) still receive their own taps. Background
          is opaque so list rows behind don't bleed through during scroll. */}
      {listHeader && (
        <View
          style={styles.chromeOverlay}
          onLayout={onChromeLayout}
          pointerEvents="box-none"
        >
          {listHeader}
        </View>
      )}
    </>
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
  // Inset hairline between consecutive notices. `marginLeft: 24` aligns the
  // line's left edge with the row text (ListRow's default horizontal
  // padding). grey200 rather than SDS's usual grey100 hairline because
  // notice rows are tall multi-line blocks — a grey100 line disappears
  // against the whitespace between them.
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey200,
    marginLeft: 24,
  },
  footer: {
    paddingVertical: 20,
  },
  endOfList: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  chromeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: SdsColors.background,
  },
});
