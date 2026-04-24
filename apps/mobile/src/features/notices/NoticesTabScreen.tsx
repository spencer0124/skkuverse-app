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
} from '@skkuverse/shared';
import { Tab, Txt } from '@skkuverse/sds';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeSelector } from './NoticeSelector';
import { NoticePickerSheet } from './NoticePickerSheet';
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
  const [pickerTabKey, setPickerTabKey] = useState<string | null>(null);

  const pickerSelections = useSettingsStore((s) => s.pickerSelections);
  const setPickerSelection = useSettingsStore((s) => s.setPickerSelection);
  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const subscriptionUid = !isAnonymous ? uid : null;

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

  // Picker confirm sync semantics (v4):
  // - Store update is unconditional — the picker drives the *view* regardless
  //   of notification state.
  // - Subscription sync runs only if the tab's notification is currently ON
  //   (ANY prefix-topic present in Firestore prefs). Under the category-level
  //   UX the tab toggle covers all picker selections together, so the picker
  //   edit must add new items AND drop items no longer selected AND clean up
  //   any stale prefix-topics left over from the v3 per-item UX. We compute
  //   the full target set via resolvePickerSelection (same source of truth as
  //   the settings screen) and diff against the live prefix-scoped subset.
  const handlePickerConfirm = useCallback(
    (newIds: string[]) => {
      if (!pickerTabKey) return;
      const tab = tabs.find((x) => x.key === pickerTabKey);
      if (!tab || !tab.picker) return;

      // SSOT update — zustand store. Only writer for pickerSelections.
      setPickerSelection(pickerTabKey, newIds);

      if (!subscriptionUid) return;

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

      // Call-time read — avoids a stale closure on the in-flight optimistic
      // snapshot from rapid successive confirms.
      const currentTopics =
        useNotificationStore.getState().preferences.subscribedTopics;
      const existingForPrefix = currentTopics.filter((topic) =>
        topic.startsWith(`${prefix}:`),
      );

      // Tab is OFF (no prefix-topic present) → picker edit has no subscription
      // effect. Keep store change, skip the write.
      if (existingForPrefix.length === 0) return;

      const targetTopics = resolvePickerSelection(tab, newIds).map((id) =>
        buildTopic(prefix, id),
      );
      const targetSet = new Set(targetTopics);
      const currentSet = new Set(currentTopics);

      const toAdd = targetTopics.filter((topic) => !currentSet.has(topic));
      const toRemove = existingForPrefix.filter(
        (topic) => !targetSet.has(topic),
      );

      // Firestore delta API disallows mixed add+remove in one call, so we
      // sequence them. Fire-and-forget to keep the sheet dismiss animation
      // off the network critical path.
      if (toAdd.length > 0) {
        updateSubscribedTopics(subscriptionUid, { add: toAdd }).catch((e) => {
          logHandledError('notifications/picker-sync-add', e);
        });
      }
      if (toRemove.length > 0) {
        updateSubscribedTopics(subscriptionUid, { remove: toRemove }).catch(
          (e) => {
            logHandledError('notifications/picker-sync-remove', e);
          },
        );
      }
    },
    [pickerTabKey, tabs, setPickerSelection, subscriptionUid],
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
