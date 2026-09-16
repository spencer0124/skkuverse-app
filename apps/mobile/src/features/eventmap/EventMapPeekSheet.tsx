/**
 * Peek sheet for a tapped event pin.
 *
 * **One place, not a stack.** This used to list every occupant of the tapped
 * `stackKey`, because several sessions collapsed onto one plot and a tap could
 * not say which was meant. A place is one document now and `tap.placeId` is its
 * own id, so two booths sharing a coordinate are two taps — and which of them
 * the pin stands for at this hour is `resolvePinCollisions`' answer, made
 * before the tap ever happens.
 *
 * ## What this file owns, and what it does not
 *
 * The body is `place/PlaceSheetScroll` — a summary every kind of place shares,
 * then tabs for whatever the place's detail fills in. What stays here is the
 * sheet chrome and its height: the pinned close button, and the one decision
 * the body cannot make for itself, which is how tall the collapsed card is.
 */

import React, { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SdsSpacing, useT, type MapOverlay } from '@skkuverse/shared';
import {
  Sheet,
  SheetCloseButton,
  SHEET_DETENT_PERCENT,
  type SheetPosition,
  type SheetRef,
} from '@skkuverse/sds';
import { placeIdOf, PlaceSheetScroll } from './place/PlaceSheetScroll';
import { fittedDetentHeight } from './place/sheetFold';
import { SHEET_HANDLE_HEIGHT, SheetCardClip } from './SheetCardClip';

/**
 * The scroll content's own bottom padding, before the card's bottom gap is
 * added to it.
 */
const CONTENT_BOTTOM_PAD = 32;
/** A sheet that ends at its summary has no list to pad below. */
const FITTED_BOTTOM_PAD = SdsSpacing.xs;

/** The pinned header before it has been measured: a 32pt button and its padding. */
const HEADER_ESTIMATE = 40;

const DETENTS = ['small', 'large'] as const;
const EXPANDABLE: SheetPosition = { kind: 'expandable', detents: DETENTS };

interface EventMapPeekSheetProps {
  place: MapOverlay | null;
  /** From `useWindowClock`, so the pill matches the pin that was tapped. */
  now: number;
  /**
   * Every festival day the served places open on, from `festivalDaysOf` over
   * all event overlays — the base a place's 1일차/2일차 is counted from.
   */
  festivalDays: readonly string[];
  /** The tapped pin's layer label, for a place that has no detail to name its kind. */
  categoryLabel: string | null;
  /**
   * Gap between the card's bottom edge and the screen's, in the modal's own
   * (window) coordinates — the campus card's edge restated, so the two cards
   * sit on one line. Computed by `CampusScreen`, which measures both.
   */
  bottomGap: number;
  onDismiss: () => void;
  /**
   * Fired immediately before an action button dismisses the sheet to navigate.
   *
   * The dismiss that follows is indistinguishable from the user's own — same
   * callback, same everything — so the screen is told in advance which one is
   * coming. Without it `onDismiss` cannot know whether to throw the selection
   * away or hold it for the way back.
   */
  onNavigateAway?: () => void;
}

export const EventMapPeekSheet = forwardRef<SheetRef, EventMapPeekSheetProps>(
  function EventMapPeekSheet(
    { place, now, festivalDays, categoryLabel, bottomGap, onDismiss, onNavigateAway },
    ref,
  ) {
    const { t } = useT();
    const { height: windowHeight } = useWindowDimensions();

    const [headerHeight, setHeaderHeight] = useState(HEADER_ESTIMATE);
    const [hasTabs, setHasTabs] = useState(true);
    const [contentHeight, setContentHeight] = useState<number | null>(null);
    const chromeAbove = SHEET_HANDLE_HEIGHT + headerHeight;

    // Owned here rather than inside `Sheet`, so the clip below reads the same
    // position the card's background is drawn from.
    const animatedIndex = useSharedValue(-1);
    const animatedPosition = useSharedValue(0);

    const placeKey = place ? placeIdOf(place) : null;
    useEffect(() => {
      setContentHeight(null);
    }, [placeKey]);

    const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
      setHeaderHeight(e.nativeEvent.layout.height);
    }, []);

    // A place with nothing below its summary — a toilet — is shrunk to the
    // summary, so the collapsed card is not mostly empty glass. The top detent
    // stays `large`: that is what makes this sheet crossfade, and switching the
    // sheet between crossfading and floating per place would swap its whole
    // background mid-presentation.
    const fitted = hasTabs
      ? null
      : fittedDetentHeight({
          containerHeight: windowHeight,
          detentPercent: SHEET_DETENT_PERCENT.small,
          bottomGap,
          chromeAbove,
          contentHeight,
        });
    const position = useMemo<SheetPosition>(
      () =>
        fitted === null
          ? EXPANDABLE
          : { kind: 'expandable', detents: DETENTS, heights: { small: fitted } },
      [fitted],
    );

    // Room under the last row once the sheet attaches and runs to the screen's
    // bottom edge. `bottomGap` already clears the home indicator in both
    // callers; the band below the floating card is `SheetCardClip`'s job.
    const bottomPadding = (hasTabs ? CONTENT_BOTTOM_PAD : FITTED_BOTTOM_PAD) + bottomGap;

    return (
      <Sheet
        ref={ref}
        // `small` shows the place's summary with the map still showing the pin
        // it describes; `large` is the whole place, tabs included. It no longer
        // has to clear the campus sheet's own detents — that sheet steps aside
        // (closes) before this one rises and returns when it goes, so the two
        // are never on screen together. See `sheetHandoff.ts`.
        position={position}
        // Because the top detent is `large`, this is the one modal that
        // CROSSFADES: a floating card down low, an ordinary opaque sheet once
        // it attaches, matching the campus sheet it rose in place of. The
        // filter sheet, which stops at `medium`, keeps one shape and gets
        // gorhom's cheaper `detached` card instead.
        surface="glass"
        bottomGap={bottomGap}
        animatedIndex={animatedIndex}
        animatedPosition={animatedPosition}
        // The default 'switch' MINIMIZES BuildingDetailSheet and restores it when
        // this closes, resurfacing a sheet the user never asked for.
        stackBehavior="replace"
        onDismiss={onDismiss}
      >
        <SheetCardClip
          animatedIndex={animatedIndex}
          animatedPosition={animatedPosition}
          lastIndex={DETENTS.length - 1}
          bottomGap={bottomGap}
        >
          {/* The X is a sibling of the scroll view, pinned: inside it, it would
              ride up and out of reach once the tabs outgrew the sheet. No title
              beside it — the summary carries its own. */}
          <View style={styles.header} onLayout={onHeaderLayout}>
            <SheetCloseButton label={t('common.close')} />
          </View>
          {place ? (
            <PlaceSheetScroll
              place={place}
              now={now}
              festivalDays={festivalDays}
              categoryLabel={categoryLabel}
              bottomGap={bottomGap}
              chromeAbove={chromeAbove}
              bottomPadding={bottomPadding}
              onNavigateAway={onNavigateAway}
              onHasTabs={setHasTabs}
              onContentHeight={setContentHeight}
            />
          ) : (
            <Sheet.ScrollView style={styles.empty}>{null}</Sheet.ScrollView>
          )}
        </SheetCardClip>
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    // The content's own gutter, so the X sits flush with the cards' right edge.
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  empty: { flex: 1 },
});
