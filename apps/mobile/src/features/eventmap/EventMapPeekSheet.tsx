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
 * sheet chrome: the pinned close button, the card clip, and the detents.
 */

import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  pickI18nText,
  placeSheetOpensTall,
  SdsColors,
  SdsSpacing,
  useSettingsStore,
  useT,
  type MapOverlay,
  type PlaceDetail,
} from '@skkuverse/shared';
import {
  Sheet,
  SheetCloseButton,
  SHEET_HANDOFF_RISE,
  Txt,
  type SheetPosition,
  type SheetRef,
} from '@skkuverse/sds';
import { PlaceSheetScroll } from './place/PlaceSheetScroll';
import { SheetCardClip } from './SheetCardClip';

/**
 * The scroll content's own bottom padding, before the card's bottom gap is
 * added to it.
 */
const CONTENT_BOTTOM_PAD = 32;

const DETENTS = ['small', 'large'] as const;
/**
 * Every place opens at the standard collapsed card, however short its content:
 * one kind of sheet at two heights reads as two different sheets, so a short
 * place leaves glass below its content instead. The top detent stays `large`,
 * which is what makes this sheet crossfade.
 */
const POSITION: SheetPosition = { kind: 'expandable', detents: DETENTS };
/**
 * The same two detents, opened at the top — for a place whose pin names only an
 * area (`placeSheetOpensTall`), where the low detent would keep a map in view
 * that points at nothing. Still draggable down. Module-level, like `POSITION`,
 * so a re-render hands the sheet the same object.
 */
const POSITION_TALL: SheetPosition = { kind: 'expandable', detents: DETENTS, initial: 'large' };

interface EventMapPeekSheetProps {
  place: MapOverlay | null;
  /** `place`'s sheet body, looked up by the caller; `null` draws the overlay alone. */
  detail: PlaceDetail | null;
  /** From `useWindowClock`, so the status sentence matches the tapped pin. */
  now: number;
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
    { place, detail, now, bottomGap, onDismiss, onNavigateAway },
    ref,
  ) {
    const { t } = useT();
    const lang = useSettingsStore((s) => s.appLanguage);

    // Room under the last row once the sheet attaches and runs to the screen's
    // bottom edge. `bottomGap` already clears the home indicator in both
    // callers; the band below the floating card is `SheetCardClip`'s job.
    const bottomPadding = CONTENT_BOTTOM_PAD + bottomGap;

    return (
      <Sheet
        ref={ref}
        // `small` shows the place's summary with the map still showing the pin
        // it describes; `large` is the whole place, tabs included. It no longer
        // has to clear the campus sheet's own detents — that sheet steps aside
        // (closes) before this one rises and returns when it goes, so the two
        // are never on screen together. See `sheetHandoff.ts`.
        // Read on each present: the modal mounts afresh every time it rises, so
        // the place selected before the hand-off decides where this one opens.
        position={placeSheetOpensTall(place) ? POSITION_TALL : POSITION}
        // Because the top detent is `large`, this is the one modal that
        // CROSSFADES: a floating card down low, an ordinary opaque sheet once
        // it attaches, matching the campus sheet it rose in place of. The
        // filter sheet, which stops at `medium`, keeps one shape and gets
        // gorhom's cheaper `detached` card instead.
        surface="glass"
        bottomGap={bottomGap}
        // The default 'switch' MINIMIZES BuildingDetailSheet and restores it when
        // this closes, resurfacing a sheet the user never asked for.
        stackBehavior="replace"
        // It rises only after the campus sheet has gone down, so it arrives on
        // a short timing rather than the default spring (`SHEET_HANDOFF_RISE`).
        animationConfigs={SHEET_HANDOFF_RISE}
        onDismiss={onDismiss}
      >
        <SheetCardClip
          lastIndex={DETENTS.length - 1}
          bottomGap={bottomGap}
        >
          {/* The title and X stay pinned together while the sheet body scrolls. */}
          <View style={styles.header}>
            {place ? (
              <Txt
                typography="t5"
                fontWeight="bold"
                color={SdsColors.grey900}
                numberOfLines={2}
                style={styles.headerTitle}
              >
                {pickI18nText(place.text, lang)}
              </Txt>
            ) : null}
            <SheetCloseButton label={t('common.close')} />
          </View>
          {place ? (
            <PlaceSheetScroll
              place={place}
              detail={detail}
              now={now}
              bottomPadding={bottomPadding}
              onNavigateAway={onNavigateAway}
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
    alignItems: 'flex-start',
    gap: SdsSpacing.sm,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    // The content's own gutter, so the X sits flush with the cards' right edge.
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: { flex: 1, paddingTop: 5 },
  empty: { flex: 1 },
});
