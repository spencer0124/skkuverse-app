/**
 * Top-level notices tab — server-driven tab layout.
 *
 * Tab configuration (order, types, picker department lists, labels) is
 * fetched from `GET /notices/tabs`. Two tab modes:
 *
 * - `fixed`: single dept, deptId provided by server
 * - `picker`: user selects 1..N departments via bottom sheet (dept,
 *   library, dorm, general)
 *
 * Department / library / dorm / general selection is persisted in Firestore
 * `users/{uid}/preferences/main.pickerSelections` and synced to all of
 * the user's devices (v5 SSOT). Local zustand subscribes via onSnapshot.
 *
 * Top-right bell icon: contextual deeplink to NotificationSettingsScreen.
 * Strikethrough variant when `categoryEnabled.notices === false` — Toss
 * pattern of "show current state without owning a duplicate UI." Master
 * toggle is intentionally NOT exposed here; that destructive control
 * lives only in the global Settings entry.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import notifee from '@notifee/react-native';
import { Bell, BellOff } from 'lucide-react-native';
import {
  SdsColors,
  resolvePickerSelection,
  useAuthStore,
  useNoticeTabs,
  useNotificationStore,
  useT,
  type NoticeTab,
} from '@skkuverse/shared';
import { Tab, Txt } from '@skkuverse/sds';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeSelector } from './NoticeSelector';
import { NoticePickerSheet } from './NoticePickerSheet';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';
import { setPickerSelectionRemote } from '@/services/firestore-notifications';
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
  const [pickerTabKey, setPickerTabKey] = useState<string | null>(null);

  // Picker selections + categoryEnabled both come from Firestore-synced store.
  const pickerSelections = useNotificationStore(
    (s) => s.preferences.pickerSelections,
  );
  const noticesCategoryEnabled = useNotificationStore(
    (s) => s.preferences.categoryEnabled?.notices ?? false,
  );
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const subscriptionUid = !isAnonymous ? uid : null;

  const openPicker = useCallback((tabKey: string) => {
    setPickerTabKey(tabKey);
    // Sheet present is deferred to next render after pickerTabKey updates
  }, []);

  // Present sheet when pickerTabKey changes to a valid tab
  const activePickerTab = useMemo(
    () => (pickerTabKey ? tabs.find((tab) => tab.key === pickerTabKey) : null),
    [pickerTabKey, tabs],
  );

  useEffect(() => {
    if (activePickerTab?.tabMode === 'picker') {
      sheetRef.current?.present();
    }
  }, [activePickerTab]);

  // v5 SSOT: client writes only intent. CF onPreferencesWrite derives
  // subscribedTopics. No diff-sync, no resolvePickerSelection roundtrip,
  // no Guard logic — just persist the user's chosen ids.
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
          {noticesCategoryEnabled ? (
            <Bell size={22} color={SdsColors.grey700} />
          ) : (
            <BellOff size={22} color={SdsColors.grey500} />
          )}
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
