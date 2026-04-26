/**
 * Top-level notices tab — server-driven tab layout.
 *
 * Tab configuration (order, types, picker department lists, labels) is
 * fetched from `GET /notices/tabs`. Two tab modes:
 *
 * - `fixed`: single source, sourceId provided by server
 * - `picker`: user selects 1..N departments via bottom sheet (dept,
 *   library, dorm, general)
 *
 * Picker (dept / library / dorm / general) selection is persisted in Firestore
 * `users/{uid}/preferences/main.pickerSelections` and synced to all of
 * the user's devices (v5 SSOT). Local zustand subscribes via onSnapshot.
 *
 * iOS 26 NativeTabs minimize chain root rule
 * ─────────────────────────────────────────
 * No outer container `<View>` wrapping. The component returns one of:
 *   - `<NoticeListPanel/>` (itself a SectionList root) — fixed tabs
 *   - Fragment `<>NoticeListPanel + selectorOverlay + sheet</>` — picker tabs
 *   - `<NoticeListSkeleton/>` or `<NoticeEmptyState/>` — initial transient
 *   - `null`
 *
 * Why no outer View: `RNSScrollViewFinder` runs once at
 * `mountChildComponentView(index==0)` and only sees subviews[0] one level
 * deep (the first child's grandchildren aren't mounted yet at that time).
 * If RNSScreen subviews[0] isn't a UIScrollView, the finder returns nil and
 * `tabBarMinimizeBehavior` is permanently disabled for this screen. So the
 * SectionList must be the screen root, or the first Fragment child.
 *
 * For picker tabs the selector is rendered as an absolute overlay (Fragment
 * second child — index 1 in subviews, not on the finder's chain). The
 * SectionList `contentContainerStyle.paddingTop` (= SELECTOR_HEIGHT) makes
 * room so the first row clears the overlay visually.
 *
 * For initial transient states (no activeTab yet) we return Skeleton /
 * EmptyState directly. The finder returns nil during this brief window;
 * once `activeTab` resolves, React swaps the screen root to NoticeListPanel
 * which causes RNSScreen to re-fire `mountChildComponentView` and the
 * finder picks up the SectionList.
 *
 * Full pattern + native mechanism: `docs/ios-26-native-tabs-minimize.md`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';
import notifee from '@notifee/react-native';
import {
  SdsColors,
  resolvePickerSelection,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeSelector } from './NoticeSelector';
import { NoticePickerSheet } from './NoticePickerSheet';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { useNoticesUiStore } from './store/noticesUiStore';
import { setPickerSelectionRemote } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';

// NoticeSelector measured height (paddingVertical 14*2 + Txt t7 line-height
// (~18) + 1px borderBottom). Used both for the selector overlay's natural
// height and for the SectionList's contentContainerStyle.paddingTop so the
// first row clears the overlay visually.
const SELECTOR_HEIGHT = 48;

export function NoticesTabScreen() {
  const { t } = useT();
  const { data: tabsConfig, isLoading, isError, refetch } = useNoticeTabs();
  const tabs = useMemo(() => tabsConfig?.tabs ?? [], [tabsConfig]);

  // Badge reconcile on tab focus.
  useFocusEffect(
    useCallback(() => {
      void notifee.setBadgeCount(0).catch(() => {});
      useNotificationStore.getState().resetUnread();
    }, []),
  );

  // ── Active tab state (hoisted to store so the custom header can drive it) ──
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const setActiveTabKey = useNoticesUiStore((s) => s.setActiveTabKey);

  useEffect(() => {
    if (tabs.length > 0 && !activeTabKey) {
      setActiveTabKey(tabs[0].key);
    }
  }, [tabs, activeTabKey, setActiveTabKey]);

  // ── Picker state (single sheet, dynamic binding) ──
  const sheetRef = useRef<BottomSheetModal>(null);
  const [pickerTabKey, setPickerTabKey] = useState<string | null>(null);

  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const subscriptionUid = !isAnonymous ? uid : null;

  const openPicker = useCallback((tabKey: string) => {
    setPickerTabKey(tabKey);
  }, []);

  const activePickerTab = useMemo(
    () => (pickerTabKey ? tabs.find((tab) => tab.key === pickerTabKey) : null),
    [pickerTabKey, tabs],
  );

  useEffect(() => {
    if (activePickerTab?.tabMode === 'picker') {
      sheetRef.current?.present();
    }
  }, [activePickerTab]);

  const handlePickerConfirm = useCallback(
    (newIds: string[]) => {
      if (!pickerTabKey || !subscriptionUid) return;
      setPickerSelectionRemote(subscriptionUid, pickerTabKey, newIds).catch(
        (e) => {
          logHandledError('notifications/picker-set', e);
        },
      );
    },
    [pickerTabKey, subscriptionUid],
  );

  const handlePickerDismiss = useCallback(() => {
    setPickerTabKey(null);
  }, []);

  const hasValidTabs = tabs.length > 0;
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.key === activeTabKey),
    [tabs, activeTabKey],
  );

  // Picker selection (resolved selected ids + label string), evaluated up
  // front so hooks are not called inside conditional branches below.
  const pickerSelectedIds = useMemo(
    () =>
      activeTab && activeTab.tabMode === 'picker' && activeTab.picker
        ? resolvePickerSelection(activeTab, pickerSelections[activeTab.key])
        : [],
    [activeTab, pickerSelections],
  );

  const pickerSelectorLabel = useMemo(() => {
    if (!activeTab || activeTab.tabMode !== 'picker' || !activeTab.picker) {
      return '';
    }
    return pickerSelectedIds
      .map(
        (id) =>
          activeTab.picker!.sources.find((s) => s.id === id)?.name ?? id,
      )
      .join(', ');
  }, [activeTab, pickerSelectedIds]);

  // ── Render ────────────────────────────────────────────────────────────
  // Initial transient: no activeTab yet. Rendering Skeleton / EmptyState
  // here means the screen has no UIScrollView at first mount — the finder
  // returns nil. Once activeTab is set the root element swaps to a
  // NoticeListPanel (or Fragment containing it), at which point React
  // unmounts the previous root and mounts the new one, re-firing
  // RNSBottomTabsScreen's `mountChildComponentView(index==0)` → finder
  // re-runs and now finds the SectionList.
  if (!activeTab) {
    if (isLoading) return <NoticeListSkeleton />;
    if (isError || !hasValidTabs) {
      return (
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      );
    }
    return null;
  }

  // Picker tab: SectionList + absolute selector overlay + picker sheet.
  // Fragment children become RNSScreen subviews in order; the finder only
  // walks subviews[0] (NoticeListPanel = SectionList).
  if (activeTab.tabMode === 'picker' && activeTab.picker) {
    return (
      <>
        <NoticeListPanel
          sourceIds={pickerSelectedIds}
          listHeaderHeight={SELECTOR_HEIGHT}
        />
        <View style={styles.selectorOverlay} pointerEvents="box-none">
          <NoticeSelector
            label={pickerSelectorLabel}
            onPress={() => openPicker(activeTab.key)}
          />
        </View>
        {activePickerTab?.tabMode === 'picker' && activePickerTab.picker && (
          <NoticePickerSheet
            ref={sheetRef}
            items={activePickerTab.picker.sources}
            selectedIds={resolvePickerSelection(
              activePickerTab,
              pickerSelections[activePickerTab.key],
            )}
            maxSelection={activePickerTab.picker.maxSelection}
            onConfirm={handlePickerConfirm}
            onDismiss={handlePickerDismiss}
            title={activePickerTab.label}
          />
        )}
      </>
    );
  }

  // Fixed tab: NoticeListPanel directly = SectionList directly. Nothing
  // wraps it, so the finder reaches the scroll view in one step.
  if (activeTab.tabMode === 'fixed' && activeTab.fixed) {
    return <NoticeListPanel sourceId={activeTab.fixed.sourceId} />;
  }

  return null;
}

const styles = StyleSheet.create({
  selectorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: SdsColors.background,
  },
});
