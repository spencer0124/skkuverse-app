/**
 * Top-level notices tab — server-driven tab layout.
 *
 * Tab configuration (order, types, picker department lists, labels) is
 * fetched from `GET /notices/tabs`. Two tab modes:
 *
 * - `fixed`: single dept, deptId provided by server
 * - `picker`: user selects 1..N departments via bottom sheet
 *
 * Department / library selection is persisted in settingsStore.pickerSelections
 * keyed by server tab key (e.g. 'dept', 'library').
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import notifee from '@notifee/react-native';
import { Settings } from 'lucide-react-native';
import {
  SdsColors,
  buildTopic,
  pickerPrefixForTabKey,
  resolvePickerSelection,
  useAuthStore,
  useNoticeTabs,
  useSettingsStore,
  useNotificationStore,
  useT,
  type NoticeTab,
  type TabDepartment,
} from '@skkuverse/shared';
import { Tab, Txt } from '@skkuverse/sds';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeSelector } from './NoticeSelector';
import { NoticePickerSheet } from './NoticePickerSheet';
import { AddedItemsNotificationSheet } from './AddedItemsNotificationSheet';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { updateSubscribedTopics } from '@/services/firestore-notifications';
import { logHandledError } from '@/services/crashlytics';

export function NoticesTabScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const router = useRouter();
  const { data: tabsConfig, isLoading, isError, refetch } = useNoticeTabs();
  const tabs = useMemo(() => tabsConfig?.tabs ?? [], [tabsConfig]);

  // Badge reconcile on tab focus — see P0-1 β. Resets both the OS app-icon
  // badge (iOS authoritative) and the in-app Zustand counter (tabBarBadge
  // authoritative on Android). Keeps empty deps so the callback identity is
  // stable across focus events.
  useFocusEffect(
    useCallback(() => {
      void notifee.setBadgeCount(0).catch(() => {});
      useNotificationStore.getState().resetUnread();
    }, []),
  );

  // ── Tab state ──
  const [activeTabKey, setActiveTabKey] = useState<string>('');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set());

  // Initialize active tab to first server tab when data loads
  useEffect(() => {
    if (tabs.length > 0 && activeTabKey === '') {
      setActiveTabKey(tabs[0].key);
      setVisitedTabs(new Set([tabs[0].key]));
    }
  }, [tabs, activeTabKey]);

  const handleTabChange = useCallback((tab: string) => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    setActiveTabKey(tab);
  }, []);

  // ── Picker state (single sheet, dynamic binding) ──
  const sheetRef = useRef<BottomSheetModal>(null);
  const addedSheetRef = useRef<BottomSheetModal>(null);
  const [pickerTabKey, setPickerTabKey] = useState<string | null>(null);

  const pickerSelections = useSettingsStore((s) => s.pickerSelections);
  const setPickerSelection = useSettingsStore((s) => s.setPickerSelection);
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const subscriptionUid = !isAnonymous ? uid : null;

  // Pending items added in the last picker confirm. Consumed by the picker's
  // onDismiss callback to present the opt-in sheet after the dismiss
  // animation completes — @gorhom/bottom-sheet overlaps dismiss+present into
  // a native race if done synchronously.
  type PendingAdded = {
    tabKey: string;
    addedIds: string[];
    departments: TabDepartment[];
    prefix: string;
  };
  const [pendingAdded, setPendingAdded] = useState<PendingAdded | null>(null);

  const openPicker = useCallback((tabKey: string) => {
    setPickerTabKey(tabKey);
    // Sheet present is deferred to next render after pickerTabKey updates
  }, []);

  // Present sheet when pickerTabKey changes to a valid tab
  const activePickerTab = useMemo(
    () => (pickerTabKey ? tabs.find((t) => t.key === pickerTabKey) : null),
    [pickerTabKey, tabs],
  );

  useEffect(() => {
    if (activePickerTab?.tabMode === 'picker') {
      sheetRef.current?.present();
    }
  }, [activePickerTab]);

  const handlePickerConfirm = useCallback(
    (newIds: string[], { oldIds }: { oldIds: string[] }) => {
      if (!pickerTabKey) return;
      const tab = tabs.find((x) => x.key === pickerTabKey);
      if (!tab || !tab.picker) return;

      // SSOT update — zustand store. This is the only writer for pickerSelections.
      setPickerSelection(pickerTabKey, newIds);

      const prefix = pickerPrefixForTabKey(pickerTabKey);
      if (!prefix) {
        if (__DEV__) {
          console.warn(
            '[notifications] no topic prefix for picker tab',
            pickerTabKey,
          );
        }
        return;
      }

      const added = newIds.filter((id) => !oldIds.includes(id));
      const removed = oldIds.filter((id) => !newIds.includes(id));

      // Cascade removal is fire-and-forget — awaiting would delay the sheet
      // dismiss animation behind Firestore latency.
      if (removed.length > 0 && subscriptionUid) {
        const removedTopics = removed.map((id) => buildTopic(prefix, id));
        updateSubscribedTopics(subscriptionUid, {
          remove: removedTopics,
        }).catch((e) => {
          logHandledError('notifications/cascade-remove', e);
        });
      }

      if (added.length > 0 && subscriptionUid) {
        setPendingAdded({
          tabKey: pickerTabKey,
          addedIds: added,
          departments: tab.picker.departments,
          prefix,
        });
      }
    },
    [pickerTabKey, tabs, setPickerSelection, subscriptionUid],
  );

  // Picker sheet onDismiss → if a pending add exists, surface the opt-in sheet.
  const handlePickerDismiss = useCallback(() => {
    setPickerTabKey(null);
    if (pendingAdded) {
      addedSheetRef.current?.present();
    }
  }, [pendingAdded]);

  const handleAddedResolve = useCallback(
    (checkedIds: string[]) => {
      if (pendingAdded && subscriptionUid && checkedIds.length > 0) {
        const topics = checkedIds.map((id) =>
          buildTopic(pendingAdded.prefix, id),
        );
        updateSubscribedTopics(subscriptionUid, { add: topics }).catch((e) => {
          logHandledError('notifications/cascade-add', e);
        });
      }
      setPendingAdded(null);
      addedSheetRef.current?.dismiss();
    },
    [pendingAdded, subscriptionUid],
  );

  const handleAddedDismiss = useCallback(() => {
    // Swipe / backdrop / "Later" — no-op on subscriptions.
    setPendingAdded(null);
  }, []);

  const hasValidTabs = tabs.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Txt typography="t3" fontWeight="bold" color={SdsColors.grey900}>
          {t('notices.title')}
        </Txt>
        <Pressable
          hitSlop={12}
          onPress={() => router.push('/notifications/settings' as never)}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.settings')}
          style={styles.headerAction}
        >
          <Settings size={22} color={SdsColors.grey700} />
        </Pressable>
      </View>

      {isLoading ? (
        <NoticeListSkeleton />
      ) : isError || !hasValidTabs ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      ) : (
        <>
          <Tab value={activeTabKey} onChange={handleTabChange} size="small" fluid>
            {tabs.map((tab) => (
              <Tab.Item key={tab.key} value={tab.key}>
                {tab.label}
              </Tab.Item>
            ))}
          </Tab>

          <View style={styles.panels}>
            {tabs.map((tab) => {
              if (!visitedTabs.has(tab.key)) return null;
              const isActive = activeTabKey === tab.key;

              if (tab.tabMode === 'picker' && tab.picker) {
                return (
                  <PickerPanel
                    key={tab.key}
                    tab={tab}
                    isActive={isActive}
                    storedIds={pickerSelections[tab.key]}
                    onOpenPicker={() => openPicker(tab.key)}
                  />
                );
              }

              if (tab.tabMode === 'fixed' && tab.fixed) {
                return (
                  <View
                    key={tab.key}
                    style={[styles.panel, !isActive && styles.hidden]}
                  >
                    <NoticeListPanel deptId={tab.fixed.deptId} />
                  </View>
                );
              }

              return null; // unknown tabMode — skip
            })}
          </View>

          {/* Single picker sheet, dynamically bound to the active picker tab */}
          {activePickerTab?.tabMode === 'picker' && activePickerTab.picker && (
            <NoticePickerSheet
              ref={sheetRef}
              items={activePickerTab.picker.departments}
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

          {/* Opt-in sheet presented from the picker's onDismiss, not inline. */}
          {pendingAdded && (
            <AddedItemsNotificationSheet
              ref={addedSheetRef}
              addedIds={pendingAdded.addedIds}
              departments={pendingAdded.departments}
              onResolve={handleAddedResolve}
              onDismiss={handleAddedDismiss}
            />
          )}
        </>
      )}
    </View>
  );
}

// ── Picker panel sub-component (avoids inline useMemo in loop) ──

function PickerPanel({
  tab,
  isActive,
  storedIds,
  onOpenPicker,
}: {
  tab: NoticeTab;
  isActive: boolean;
  storedIds: string[] | undefined;
  onOpenPicker: () => void;
}) {
  const selectedIds = useMemo(
    () => resolvePickerSelection(tab, storedIds),
    [tab, storedIds],
  );

  const selectorLabel = useMemo(
    () =>
      selectedIds
        .map((id) => tab.picker!.departments.find((d) => d.id === id)?.name ?? id)
        .join(', '),
    [selectedIds, tab.picker],
  );

  return (
    <View style={[styles.panel, !isActive && styles.hidden]}>
      <NoticeSelector label={selectorLabel} onPress={onOpenPicker} />
      <NoticeListPanel deptIds={selectedIds} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerAction: {
    marginLeft: 'auto',
  },
  panels: {
    flex: 1,
    backgroundColor: SdsColors.grey100,
  },
  panel: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
