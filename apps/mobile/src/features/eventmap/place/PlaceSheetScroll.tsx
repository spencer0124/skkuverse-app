/**
 * The place sheet's scroll content: summary, then its continuous detail flow.
 *
 * ```text
 * [0] PlaceSummary   what the collapsed card shows
 * [1] sections       facts, intro, representative content, and menu
 * ```
 *
 * Nothing here reads the sheet's detent. The collapsed card is one fixed size
 * (`EventMapPeekSheet`), so collapsed shows as much of the flow as fits and
 * expanded shows the rest, with no content branched on the detent — which
 * `docs/explanation/bottom-sheet-system.md` rules out.
 *
 * `facts` is always in the list, so a place the server has no detail for still
 * shows its opening hours. See `placeSections`.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import {
  placeSections,
  SdsSpacing,
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
  /** The place's sheet body from `usePlaceDetails`, or `null` for the overlay alone. */
  detail: PlaceDetail | null;
  now: number;
  /** Bottom padding of the scroll content, which already includes `bottomGap`. */
  bottomPadding: number;
  onNavigateAway?: () => void;
}

export function PlaceSheetScroll({
  place,
  detail,
  now,
  bottomPadding,
  onNavigateAway,
}: PlaceSheetScrollProps) {
  const placeId = placeIdOf(place);

  const sections = useMemo(() => placeSections(detail), [detail]);

  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

  // Another pin tapped while the sheet is up: start the new place from the top
  // of its detail flow, not from wherever the last one was left.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [placeId]);

  return (
    <Sheet.ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
    >
      <PlaceSummary
        place={place}
        detail={detail}
        now={now}
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
