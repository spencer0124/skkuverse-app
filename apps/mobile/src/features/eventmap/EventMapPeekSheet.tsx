/**
 * Peek sheet for a tapped event pin.
 *
 * One pin can stand for several occupants of the same plot — a day booth and a
 * night 주점 share coordinates — so this lists every item on the tapped
 * `stackKey`, lead first, rather than showing only what the marker drew.
 *
 * ## What this file owns, and what it does not
 *
 * The card body is the server's: `CardRenderer` draws whatever slots the item's
 * `cardTemplateId` resolves to. What stays here is everything the template does
 * not describe — the sheet chrome and the actions row, including the
 * dismiss-before-navigate discipline in `ActionButton`, which is a portal
 * ordering constraint rather than a styling choice.
 *
 * Still not rendered: `media.images`. It is carried on the item but has no slot
 * kind, so a gallery would be a wire contract addition.
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetModal,
} from '@gorhom/bottom-sheet';
import {
  resolveSlots,
  SdsColors,
  type EventMapAction,
  type EventMapCardTemplate,
  type EventMapStack,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { handleSduiAction } from '@/sdui/action-handler';
import { CardRenderer } from './CardRenderer';

/**
 * Strictly above the persistent CampusScreen BottomSheet's collapsed detent
 * (`SHEET_SNAP_PERCENTS` there), so this fully occludes it rather than stacking
 * a second grab handle on its chrome. Both are real sheets with their own pan
 * responders, and overlapping them silently puts two in the same band.
 *
 * The number is not derived from that one, so lowering the campus sheet gives
 * this more clearance rather than less — but raising it back above this value
 * would break the occlusion, which is the direction to watch.
 */
const PEEK_MIN_SNAP = '45%';

interface EventMapPeekSheetProps {
  stack: EventMapStack | null;
  /** Snapshot templates, keyed by id. `undefined` for an item falls back inside `resolveSlots`. */
  cardTemplates: Map<string, EventMapCardTemplate>;
  onDismiss: () => void;
}

export const EventMapPeekSheet = forwardRef<BottomSheetModal, EventMapPeekSheetProps>(
  function EventMapPeekSheet({ stack, cardTemplates, onDismiss }, ref) {
    const snapPoints = useMemo(() => [PEEK_MIN_SNAP, '85%'], []);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        handleIndicatorStyle={styles.handleIndicator}
        // The default 'switch' MINIMIZES BuildingDetailSheet and restores it when
        // this closes, resurfacing a sheet the user never asked for.
        stackBehavior="replace"
        onDismiss={onDismiss}
      >
        <BottomSheetScrollView style={styles.container} contentContainerStyle={styles.content}>
          {stack?.items.map((item, index) => (
            <View key={item.id} style={index > 0 ? styles.subsequent : undefined}>
              <ItemBody item={item} template={cardTemplates.get(item.cardTemplateId)} />
            </View>
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

function ItemBody({
  item,
  template,
}: {
  item: EventMapStack['lead'];
  template: EventMapCardTemplate | undefined;
}) {
  // `content` is prose to show in place. The global dispatcher is
  // fire-and-forget and has no surface to render into, so the split happens
  // here — and `miniapp`/`unknown` render nothing at all, because a button that
  // does nothing is worse than a missing button.
  const inline = item.actions.filter((a) => a.actionType === 'content');
  const buttons = item.actions.filter(
    (a) => a.actionType === 'route' || a.actionType === 'webview' || a.actionType === 'external',
  );

  return (
    <View>
      <CardRenderer slots={resolveSlots(template, item)} status={item.status} />

      {inline.map((action) => (
        <View key={action.id} style={styles.inlineBlock}>
          {action.label ? (
            <Txt typography="t7" fontWeight="bold" color={SdsColors.grey700}>
              {action.label}
            </Txt>
          ) : null}
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

function ActionButton({ action }: { action: EventMapAction }) {
  // `dismiss()` with no key closes the top-most modal in the provider's queue,
  // which is this sheet whenever one of its own buttons is being pressed.
  const { dismiss } = useBottomSheetModal();

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
    // behaviour we want: onDismiss clears selectedStackKey, so backing out of
    // the webview lands on the plain campus map instead of a sheet the user
    // already navigated away from.
    dismiss();
    handleSduiAction({
      actionType: action.actionType,
      actionValue: action.actionValue,
      // The button's own label titles the webview, so the user lands on a screen
      // named after what they tapped.
      webviewTitle: action.label,
    });
  }, [action, dismiss]);

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
        {action.label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  handleIndicator: {
    backgroundColor: SdsColors.grey300,
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  subsequent: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SdsColors.grey200,
  },
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
