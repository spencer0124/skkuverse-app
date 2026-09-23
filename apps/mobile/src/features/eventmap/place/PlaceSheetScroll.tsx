/**
 * The place sheet's scroll content: summary, then its continuous detail flow.
 *
 * ```text
 * [0] PlaceSummary   what the collapsed card shows
 * [1] sections       facts, intro, representative content, and menu
 * ```
 *
 * Nothing here reads the sheet's detent. Collapsed shows the summary and
 * expanded shows the rest because the CARD is sized to the summary
 * (`sheetFold.ts` measures it through `onSummaryHeight`), not because the
 * content is branched on the detent — which
 * `docs/explanation/bottom-sheet-system.md` rules out.
 *
 * `facts` is always in the list, so a place the server has no detail for still
 * shows its opening hours. See `placeSections`.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import {
  placeSections,
  SdsSpacing,
  usePlaceDetail,
  type MapOverlay,
  type PlaceDetail,
  type PlaceSectionKey,
} from '@skkuverse/shared';
import { Sheet } from '@skkuverse/sds';
import { SHEET_GUTTER } from './layout';
import { PlaceSummary } from './PlaceSummary';
import { FactsSection } from './PlaceSections';
import { PlaceBlocks } from './PlaceBlocks';

/** The id a place's detail is keyed by — the one its tap carries. */
export function placeIdOf(place: MapOverlay): string {
  return place.tap?.kind === 'event' ? place.tap.placeId : place.id;
}

interface PlaceSheetScrollProps {
  place: MapOverlay;
  now: number;
  /** Every KST day the served places open on — the base a place's 1일차 counts from. */
  festivalDays: readonly string[];
  /** Bottom padding of the scroll content, which already includes `bottomGap`. */
  bottomPadding: number;
  onNavigateAway?: () => void;
  /** The scroll content's height — what the collapsed card is sized from. */
  onContentHeight?: (height: number) => void;
}

export function PlaceSheetScroll({
  place,
  now,
  festivalDays,
  bottomPadding,
  onNavigateAway,
  onContentHeight,
}: PlaceSheetScrollProps) {
  const placeId = placeIdOf(place);
  const { data } = usePlaceDetail(placeId);
  const detail = data ?? null;

  const sections = useMemo(() => placeSections(detail), [detail]);

  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

  // Another pin tapped while the sheet is up: start the new place from the top
  // of its detail flow, not from wherever the last one was left.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [placeId]);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => onContentHeight?.(height),
    [onContentHeight],
  );

  return (
    <Sheet.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      onContentSizeChange={onContentSizeChange}
    >
      <PlaceSummary
        place={place}
        detail={detail}
        now={now}
        festivalDays={festivalDays}
        onNavigateAway={onNavigateAway}
      />

      <View style={styles.sections}>
        {sections.map((section) => (
          <PlaceSection
            key={section}
            section={section}
            place={place}
            detail={detail}
            onNavigateAway={onNavigateAway}
          />
        ))}
      </View>
    </Sheet.ScrollView>
  );
}

function PlaceSection({
  section,
  place,
  detail,
  onNavigateAway,
}: {
  section: PlaceSectionKey;
  place: MapOverlay;
  detail: PlaceDetail | null;
  onNavigateAway?: () => void;
}) {
  if (section === 'facts') return <FactsSection place={place} detail={detail} />;
  // The body is the detail's own blocks; `placeSections` only names it when
  // there is at least one.
  return detail === null ? null : <PlaceBlocks blocks={detail.blocks} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  content: { paddingHorizontal: SHEET_GUTTER },
  sections: { gap: SdsSpacing.xl },
});
