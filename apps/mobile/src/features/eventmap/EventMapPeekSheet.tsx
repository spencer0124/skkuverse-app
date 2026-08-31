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
 * The card body is `PlaceCard` — a fixed layout, since the template tier left
 * the wire with the snapshot. What stays here is everything the card does not
 * describe: the sheet chrome and the actions row, including the
 * dismiss-before-navigate discipline in `ActionButton`, which is a portal
 * ordering constraint rather than a styling choice.
 */

import React, { forwardRef, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useBottomSheetModal } from '@gorhom/bottom-sheet';
import {
  pickI18nText,
  SdsColors,
  useSettingsStore,
  useT,
  type MarkerAction,
  type RawMarkerData,
} from '@skkuverse/shared';
import { Sheet, SheetCloseButton, Txt, type SheetRef } from '@skkuverse/sds';
import { handleSduiAction } from '@/sdui/action-handler';
import { PlaceCard } from './PlaceCard';

/**
 * The scroll content's own bottom padding, before the card's bottom gap is
 * added to it.
 */
const CONTENT_BOTTOM_PAD = 32;

interface EventMapPeekSheetProps {
  place: RawMarkerData | null;
  /** From `useWindowClock`, so the pill matches the pin that was tapped. */
  now: number;
  /**
   * Gap between the card's bottom edge and the screen's, in the modal's own
   * (window) coordinates — the campus card's edge restated, so the two cards
   * sit on one line. Computed by `CampusScreen`, which measures both.
   */
  bottomGap: number;
  onDismiss: () => void;
}

export const EventMapPeekSheet = forwardRef<SheetRef, EventMapPeekSheetProps>(
  function EventMapPeekSheet({ place, now, bottomGap, onDismiss }, ref) {
    const { t } = useT();

    return (
      <Sheet
        ref={ref}
        // `small` shows one card's worth with the map still showing the pin it
        // describes; `large` is the whole place. It no longer has to clear the
        // campus sheet's own detents — that sheet steps aside (closes) before
        // this one rises and returns when it goes, so the two are never on
        // screen together. See `sheetHandoff.ts`.
        position={{ kind: 'expandable', detents: ['small', 'large'] }}
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
        onDismiss={onDismiss}
      >
        {/* The X is a sibling of the scroll view, pinned: inside it, it would
            ride up and out of reach once a long field list outgrew the sheet.
            No title beside it — the card carries its own. */}
        <View style={styles.header}>
          <SheetCloseButton label={t('common.close')} />
        </View>
        {/* The card's bottom gap has to be paid for here. A crossfading sheet
            is not `detached`, so gorhom sizes the content box to the container
            rather than to the visible card — without this, a long field list
            would keep drawing below the card's bottom edge, over the map, at
            the low detent. Constant rather than animated: the extra padding is
            invisible once the sheet attaches and the floating tab bar sits
            over that band anyway. */}
        <Sheet.ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: CONTENT_BOTTOM_PAD + bottomGap },
          ]}
        >
          {place ? <PlaceBody place={place} now={now} /> : null}
        </Sheet.ScrollView>
      </Sheet>
    );
  },
);

function PlaceBody({ place, now }: { place: RawMarkerData; now: number }) {
  const lang = useSettingsStore((s) => s.appLanguage);

  // `content` is prose to show in place. The global dispatcher is
  // fire-and-forget and has no surface to render into, so the split happens
  // here — and `miniapp`/`unknown` render nothing at all, because a button that
  // does nothing is worse than a missing button.
  const inline = place.actions.filter((a) => a.actionType === 'content');
  const buttons = place.actions.filter(
    (a) => a.actionType === 'route' || a.actionType === 'webview' || a.actionType === 'external',
  );

  return (
    <View>
      <PlaceCard place={place} now={now} />

      {inline.map((action) => (
        <View key={action.id} style={styles.inlineBlock}>
          <Txt typography="t7" fontWeight="bold" color={SdsColors.grey700}>
            {pickI18nText(action.label, lang)}
          </Txt>
          <Txt typography="t7" color={SdsColors.grey900}>
            {action.actionValue}
          </Txt>
        </View>
      ))}

      {buttons.length > 0 ? (
        <View style={styles.actionRow}>
          {buttons.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({ action }: { action: MarkerAction }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  // `dismiss()` with no key closes the top-most modal in the provider's queue,
  // which is this sheet whenever one of its own buttons is being pressed.
  const { dismiss } = useBottomSheetModal();
  const label = pickI18nText(action.label, lang);

  const onPress = useCallback(() => {
    // Close BEFORE navigating. A BottomSheetModal does not live in the screen
    // that rendered it: @gorhom/portal mounts the host as a SIBLING THAT FOLLOWS
    // `children` inside BottomSheetModalProvider, which in app/_layout.tsx wraps
    // the root <Stack>. So the sheet is outside the navigator and painted after
    // it — a pushed webview slides in UNDERNEATH and the destination arrives
    // with its bottom half eaten. Nothing about the push can fix that from the
    // other side; the sheet has to go first.
    //
    // Same reason BuildingDetailSheet dismisses before pushing /map/hssc, and
    // the reason NoticeDetailScreen's 원본 공지 보기 hands off to the system
    // browser instead of pushing.
    //
    // Dismissing (rather than restoring the sheet on the way back) is also the
    // behaviour we want: onDismiss clears selectedPlaceId, so backing out of
    // the webview lands on the plain campus map instead of a sheet the user
    // already navigated away from.
    dismiss();
    handleSduiAction({
      actionType: action.actionType,
      actionValue: action.actionValue,
      // The button's own label titles the webview, so the user lands on a screen
      // named after what they tapped.
      webviewTitle: label,
    });
  }, [action, dismiss, label]);

  const primary = action.style === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionButton, primary ? styles.actionPrimary : styles.actionSecondary]}
      accessibilityRole="button"
    >
      <Txt
        typography="t6"
        fontWeight="bold"
        color={primary ? '#FFFFFF' : SdsColors.grey900}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

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
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  content: { paddingHorizontal: 20 },
  inlineBlock: { marginTop: 12, gap: 2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: { backgroundColor: SdsColors.brand },
  actionSecondary: { backgroundColor: SdsColors.grey100 },
});
