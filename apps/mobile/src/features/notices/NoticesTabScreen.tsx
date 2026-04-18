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
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  SdsColors,
  useNoticeTabs,
  useSettingsStore,
  useT,
  type NoticeTab,
} from '@skkuverse/shared';
import { Tab, Txt } from '@skkuverse/sds';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeSelector } from './NoticeSelector';
import { NoticePickerSheet } from './NoticePickerSheet';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';

// ── Helpers ──

/**
 * Returns the effective selected IDs for a picker tab, validating stored
 * selections against the current server response and falling back as needed.
 */
function resolvePickerSelection(
  tab: NoticeTab,
  stored: string[] | undefined,
): string[] {
  const picker = tab.picker!;
  const validIds = new Set(picker.departments.map((d) => d.id));

  if (stored && stored.length > 0) {
    const valid = stored.filter((id) => validIds.has(id));
    if (valid.length > 0) return valid;
  }

  // Fall back to server defaults
  if (picker.defaultDeptIds.length > 0) {
    return picker.defaultDeptIds.filter((id) => validIds.has(id));
  }

  // Last resort: first department
  return picker.departments.length > 0 ? [picker.departments[0].id] : [];
}

export function NoticesTabScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { data: tabsConfig, isLoading, isError, refetch } = useNoticeTabs();
  const tabs = useMemo(() => tabsConfig?.tabs ?? [], [tabsConfig]);

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
    (ids: string[]) => {
      if (pickerTabKey) setPickerSelection(pickerTabKey, ids);
    },
    [pickerTabKey, setPickerSelection],
  );

  const hasValidTabs = tabs.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Txt typography="t3" fontWeight="bold" color={SdsColors.grey900}>
          {t('notices.title')}
        </Txt>
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
              onDismiss={() => setPickerTabKey(null)}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
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
