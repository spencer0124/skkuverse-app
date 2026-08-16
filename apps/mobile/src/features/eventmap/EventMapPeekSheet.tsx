/**
 * Peek sheet for a tapped event pin.
 *
 * One pin can stand for several occupants of the same plot — a day booth and a
 * night 주점 share coordinates — so this lists every item on the tapped
 * `stackKey`, lead first, rather than showing only what the marker drew.
 *
 * ## Phase 3 scope
 *
 * `cardTemplates` and a template-driven `CardRenderer` are Phase 6 (#18). Until
 * then `ItemBody` reads the item's fields directly. That is a seam, not a
 * placeholder: when Phase 6 lands, `<ItemBody item={…}/>` becomes
 * `<CardRenderer template={…} item={…}/>` and the status pill, the actions row
 * and the sheet chrome are untouched.
 *
 * Deliberately NOT rendered yet: `tags`, `fields`, `cardTemplateId`, `media.images`.
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetModal,
} from '@gorhom/bottom-sheet';
import {
  SdsColors,
  useT,
  type EventMapAction,
  type EventMapStack,
  type ItemStatus,
  type TranslationKey,
} from '@skkuverse/shared';
import { Badge, Txt } from '@skkuverse/sds';
import { handleSduiAction } from '@/sdui/action-handler';

/**
 * Strictly above the persistent CampusScreen BottomSheet's 30% detent, so this
 * fully occludes it rather than stacking a second grab handle on its chrome.
 * Both are real sheets with their own pan responders; dropping below ~32%
 * silently puts two of them in the same band.
 */
const PEEK_MIN_SNAP = '45%';

const STATUS_LABEL: Record<ItemStatus, TranslationKey> = {
  open: 'eventmap.status.open',
  upcoming: 'eventmap.status.upcoming',
  closed: 'eventmap.status.closed',
  unknown: 'eventmap.status.unknown',
};

const STATUS_STYLE: Record<ItemStatus, { color: string; backgroundColor: string }> = {
  open: { color: SdsColors.brand, backgroundColor: SdsColors.grey100 },
  upcoming: { color: SdsColors.grey700, backgroundColor: SdsColors.grey100 },
  closed: { color: SdsColors.grey500, backgroundColor: SdsColors.grey100 },
  unknown: { color: SdsColors.grey500, backgroundColor: SdsColors.grey100 },
};

interface EventMapPeekSheetProps {
  stack: EventMapStack | null;
  onDismiss: () => void;
}

export const EventMapPeekSheet = forwardRef<BottomSheetModal, EventMapPeekSheetProps>(
  function EventMapPeekSheet({ stack, onDismiss }, ref) {
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
              <ItemBody item={item} />
            </View>
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

function ItemBody({ item }: { item: EventMapStack['lead'] }) {
  const { t } = useT();

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
      <View style={styles.headerRow}>
        {item.media.thumbnailUrl ? (
          <Image source={{ uri: item.media.thumbnailUrl }} style={styles.thumbnail} />
        ) : null}
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Txt typography="t5" fontWeight="bold" style={styles.title}>
              {item.title}
            </Txt>
            <Badge size="small" {...STATUS_STYLE[item.status]}>
              {t(STATUS_LABEL[item.status])}
            </Badge>
          </View>
          {item.subtitle ? (
            <Txt typography="t7" color={SdsColors.grey700}>
              {item.subtitle}
            </Txt>
          ) : null}
          {item.hoursLabel ? (
            <Txt typography="t7" color={SdsColors.grey500}>
              {item.hoursLabel}
            </Txt>
          ) : null}
        </View>
      </View>

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
  headerRow: { flexDirection: 'row', gap: 12 },
  thumbnail: { width: 56, height: 56, borderRadius: 8, backgroundColor: SdsColors.grey100 },
  headerText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1 },
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
