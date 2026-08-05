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
import { useNoticeSiblingsStore } from './store/noticeSiblingsStore';
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
  /**
   * In-scroll header, distinct from `listHeader` above: `listHeader` is the
   * absolute-positioned chrome overlay (tab strip + selector) that stays put,
   * whereas this goes through `ListHeaderComponent` and scrolls away with the
   * rows. Used by the search screen for the answer card.
   *
   * The FlatList is still the Fragment's first child either way, so the iOS 26
   * chain-root rule is untouched — and both props are optional so the notices
   * tab's render path is unchanged.
   */
  answerSlot?: ReactElement;
  /**
   * Recovery CTA shown when a `q` search returns nothing (e.g. "전체 공지에서
   * 찾아보기"). Only reachable via the search-empty branch; omitted elsewhere.
   */
  searchEmptyAction?: { label: string; onPress: () => void };
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
  const answerSlot = props.answerSlot;
  const searchEmptyAction = props.searchEmptyAction;
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
  const setSiblings = useNoticeSiblingsStore((s) => s.setItems);
  const handleSelect = useCallback(
    (n: NoticeListItem) => {
      logNoticesContentSelect({
        content_type: 'list_row',
        item_id: `${navSourceId ?? n.sourceId}/${n.articleNo}`,
      });
      // 상세 화면의 이전/다음 네비게이션 컨텍스트. 지금 화면에 로드된 만큼만
      // 넘긴다 — 무한스크롤로 더 받아 두었으면 그만큼 더 넘어간다. 라우트에
      // 쓰인 sourceId(다중 소스 탭에서는 item의 것)를 그대로 저장해야
      // 상세 화면의 params와 매칭된다.
      setSiblings(
        items.map((it) => ({
          sourceId: navSourceId ?? it.sourceId,
          articleNo: it.articleNo,
          title: it.title,
        })),
      );
      router.push(`/notices/${navSourceId ?? n.sourceId}/${n.articleNo}` as never);
    },
    [router, navSourceId, items, setSiblings],
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
        // `chromeHeight` only means anything when the overlay is actually
        // rendered. Without `listHeader` the overlay never mounts, so
        // `onChromeLayout` never fires and the estimate would sit there
        // forever as a dead top margin (visible on the search screen, which
        // passes no chrome).
        style={[styles.list, { marginTop: listHeader ? chromeHeight : 0 }]}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        ItemSeparatorComponent={RowDivider}
        contentContainerStyle={[
          styles.listContent,
          isEmpty ? styles.emptyContent : null,
        ]}
        ListHeaderComponent={answerSlot}
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
            <NoticeEmptyState
              message={t('notices.search.empty.subtitle')}
              actionLabel={searchEmptyAction?.label}
              onAction={searchEmptyAction?.onPress}
            />
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
