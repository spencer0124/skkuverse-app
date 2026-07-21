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
 * For picker tabs the selector is rendered inside the SectionList via
 * NoticeListPanel's `listHeader` prop (= ListHeaderComponent). This keeps
 * the SectionList as the chain root while guaranteeing the selector
 * mounts as the list's first row. The selector scrolls with the list (no
 * sticky pinning) — acceptable trade-off for a robust visible mount.
 *
 * For initial transient states (no activeTab yet) we return Skeleton /
 * EmptyState directly. The finder returns nil during this brief window;
 * once `activeTab` resolves, React swaps the screen root to NoticeListPanel
 * which causes RNSScreen to re-fire `mountChildComponentView` and the
 * finder picks up the SectionList.
 *
 * Full pattern + native mechanism: `docs/explanation/ios-26-native-tabs-minimize.md`.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import notifee from '@notifee/react-native';
import {
  resolvePickerSelection,
  useNoticeTabs,
  useNotificationStore,
  useT,
} from '@skkuverse/shared';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeSelector } from './NoticeSelector';
import { NoticesTabStrip } from './components/NoticesTabStrip';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { useNoticesUiStore } from './store/noticesUiStore';

export function NoticesTabScreen() {
  const { t } = useT();
  const router = useRouter();
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

  // ── Picker state (delegated to /notices/picker route) ──
  // Tapping the selector pushes a native iOS form-sheet route which owns
  // its own pending state, search, and grouping. Selection commit happens
  // inside that route via setPickerSelectionRemote → Firestore listener
  // pushes the new value back into pickerSelections, re-rendering this
  // screen with the new sourceIds.
  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections ?? {},
  );

  const openPicker = useCallback(
    (tabKey: string) => {
      router.push(`/notices/picker?tabKey=${encodeURIComponent(tabKey)}`);
    },
    [router],
  );

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

  // Picker tab: NoticeListPanel hosts NoticesTabStrip + the dept selector
  // inside its SectionList via `listHeader`, so both are guaranteed to mount
  // as the list's first rows. NoticeListPanel is the screen root → RNSScreen
  // subviews[0] is the SectionList → minimize-on-scroll finder reaches it.
  // The picker sheet is now a separate route (`/notices/picker`), mounted
  // by the navigator in its own RNSScreen — no overlay child here.
  if (activeTab.tabMode === 'picker' && activeTab.picker) {
    return (
      <NoticeListPanel
        sourceIds={pickerSelectedIds}
        listHeader={
          <>
            <NoticesTabStrip />
            <NoticeSelector
              label={pickerSelectorLabel}
              onPress={() => openPicker(activeTab.key)}
            />
          </>
        }
      />
    );
  }

  // Fixed tab: NoticeListPanel directly = SectionList directly. NoticesTabStrip
  // is hosted as the SectionList's ListHeaderComponent so the finder still
  // reaches the scroll view in one step (subviews[0] = SectionList).
  if (activeTab.tabMode === 'fixed' && activeTab.fixed) {
    return (
      <NoticeListPanel
        sourceId={activeTab.fixed.sourceId}
        listHeader={<NoticesTabStrip />}
      />
    );
  }

  return null;
}
