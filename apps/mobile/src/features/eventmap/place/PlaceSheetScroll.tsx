/**
 * The place sheet's scroll content: summary, then tabs.
 *
 * ```text
 * [0] PlaceSummary   everything the collapsed card shows, at least a fold tall
 * [1] tab bar        only with two or more tabs; sticks to the top once passed
 * [2] tab content    one tab's sections
 * ```
 *
 * The three are DIRECT children of the scroll view because `stickyHeaderIndices`
 * counts direct children — wrapping them would unstick the bar.
 *
 * Nothing here reads the sheet's detent. Collapsed shows the summary and
 * expanded shows the tabs purely because the summary is at least as tall as
 * the collapsed card's content area (`sheetFold.ts`), so the tab bar always
 * starts under the fold. That keeps the rule in
 * `docs/explanation/bottom-sheet-system.md`, "Content is not branched on the
 * detent".
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import {
  buildPlaceTabs,
  SdsColors,
  useT,
  usePlaceDetail,
  type MapOverlay,
  type PlaceDetail,
  type PlaceSectionKey,
  type PlaceTabKey,
  type TranslationKey,
} from '@skkuverse/shared';
import { Sheet, SHEET_DETENT_PERCENT, Tab } from '@skkuverse/sds';
import { logCampusContentSelect } from '@/services/analytics';
import { SectionDivider, SHEET_GUTTER } from './layout';
import { PlaceSummary } from './PlaceSummary';
import {
  ContentsSection,
  InfoSection,
  IntroSection,
  MenuSection,
  NoticesSection,
  ProseSection,
} from './PlaceSections';
import { collapsedContentHeight } from './sheetFold';

const TAB_LABEL: Record<PlaceTabKey, TranslationKey> = {
  home: 'eventmap.tab.home',
  menu: 'eventmap.tab.menu',
  info: 'eventmap.tab.info',
};

/** The id a place's detail is keyed by — the one its tap carries. */
export function placeIdOf(place: MapOverlay): string {
  return place.tap?.kind === 'event' ? place.tap.placeId : place.id;
}

interface PlaceSheetScrollProps {
  place: MapOverlay;
  now: number;
  festivalDays: readonly string[];
  categoryLabel: string | null;
  bottomGap: number;
  /** Handle plus pinned header, measured by the sheet. */
  chromeAbove: number;
  /** Bottom padding of the scroll content, which already includes `bottomGap`. */
  bottomPadding: number;
  onNavigateAway?: () => void;
  /** Reports whether anything sits below the summary, for the sheet's height. */
  onHasTabs?: (hasTabs: boolean) => void;
  onContentHeight?: (height: number) => void;
}

export function PlaceSheetScroll({
  place,
  now,
  festivalDays,
  categoryLabel,
  bottomGap,
  chromeAbove,
  bottomPadding,
  onNavigateAway,
  onHasTabs,
  onContentHeight,
}: PlaceSheetScrollProps) {
  const { t } = useT();
  const placeId = placeIdOf(place);
  const { data } = usePlaceDetail(placeId);
  const detail = data ?? null;

  const prose = useMemo(() => place.actions.filter((a) => a.actionType === 'content'), [place.actions]);
  const tabs = useMemo(
    () => buildPlaceTabs(detail, place.hours, prose.length),
    [detail, place.hours, prose.length],
  );
  const showBar = tabs.length >= 2;

  useEffect(() => {
    onHasTabs?.(tabs.length > 0);
  }, [onHasTabs, tabs.length]);

  const [tabKey, setTabKey] = useState<PlaceTabKey | null>(null);
  const active = tabs.find((tab) => tab.key === tabKey) ?? tabs[0] ?? null;

  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const scrollY = useRef(0);
  const tabBarY = useRef(0);

  // Another pin tapped while the sheet is up: start the new place from its top
  // and its first tab, not from wherever the last one was left.
  useEffect(() => {
    setTabKey(null);
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [placeId]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onTabBarLayout = useCallback((e: LayoutChangeEvent) => {
    tabBarY.current = e.nativeEvent.layout.y;
  }, []);

  const onTabChange = useCallback((next: string) => {
    const key = next as PlaceTabKey;
    setTabKey(key);
    logCampusContentSelect({ content_type: 'eventmap_detail_tab', item_id: key });
    // A reader deep in a long menu who switches tabs lands on the new tab's
    // top, the way Naver does it — not somewhere in its middle, and not back
    // above the bar.
    if (scrollY.current > tabBarY.current) {
      scrollRef.current?.scrollTo({ y: tabBarY.current, animated: false });
    }
  }, []);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => onContentHeight?.(height),
    [onContentHeight],
  );

  const { height: windowHeight } = useWindowDimensions();
  // Only a sheet that has something below its summary needs the fold: without
  // tabs the sheet is shrunk to the summary instead (`fittedDetentHeight`).
  const fold =
    tabs.length > 0
      ? collapsedContentHeight({
          // A modal's container is the window (`Sheet`'s own default).
          containerHeight: windowHeight,
          detentPercent: SHEET_DETENT_PERCENT.small,
          bottomGap,
          chromeAbove,
        })
      : 0;

  return (
    <Sheet.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      stickyHeaderIndices={showBar ? [1] : undefined}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onContentSizeChange={onContentSizeChange}
    >
      <PlaceSummary
        place={place}
        detail={detail}
        categoryLabel={categoryLabel}
        festivalDays={festivalDays}
        now={now}
        minHeight={fold}
        onNavigateAway={onNavigateAway}
      />

      {showBar && active ? (
        <View style={styles.tabBar} onLayout={onTabBarLayout}>
          <Tab value={active.key} onChange={onTabChange}>
            {tabs.map((tab) => (
              <Tab.Item key={tab.key} value={tab.key}>
                {t(TAB_LABEL[tab.key])}
              </Tab.Item>
            ))}
          </Tab>
        </View>
      ) : null}

      {active ? (
        <View>
          {showBar ? null : <SectionDivider />}
          {active.sections.map((section, i) => (
            <React.Fragment key={section}>
              {i > 0 ? <SectionDivider /> : null}
              <PlaceSection
                section={section}
                place={place}
                detail={detail}
                prose={prose}
                onNavigateAway={onNavigateAway}
              />
            </React.Fragment>
          ))}
        </View>
      ) : null}
    </Sheet.ScrollView>
  );
}

function PlaceSection({
  section,
  place,
  detail,
  prose,
  onNavigateAway,
}: {
  section: PlaceSectionKey;
  place: MapOverlay;
  detail: PlaceDetail | null;
  prose: MapOverlay['actions'];
  onNavigateAway?: () => void;
}) {
  if (section === 'prose') return <ProseSection actions={prose} />;
  // Every other section is built from the detail; `buildPlaceTabs` only names
  // them when one exists.
  if (detail === null) return null;
  switch (section) {
    case 'intro':
      return <IntroSection intro={detail.intro} logoUrl={detail.logoUrl} />;
    case 'contents':
      return <ContentsSection contents={detail.contents} />;
    case 'notices':
      return <NoticesSection notices={detail.notices} />;
    case 'menu':
      return <MenuSection entryFees={detail.entryFees} menu={detail.menu} />;
    case 'info':
      return <InfoSection detail={detail} hours={place.hours} onNavigateAway={onNavigateAway} />;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  content: { paddingHorizontal: SHEET_GUTTER },
  // Opaque, because it sticks over content scrolling underneath it; and bled to
  // the card's edges so the underline spans the sheet.
  tabBar: {
    marginHorizontal: -SHEET_GUTTER,
    paddingHorizontal: SHEET_GUTTER,
    backgroundColor: SdsColors.background,
  },
});
