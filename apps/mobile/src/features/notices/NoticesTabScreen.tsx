/**
 * Top-level notices tab — 2-tab layout (학사 / 학과).
 *
 * 학사: skku-main notices (single dept via useNoticeList)
 * 학과: merged list from user-selected departments (via useMultiDeptNoticeList)
 *
 * Department selection is persisted in settingsStore and opened via
 * a half-screen bottom sheet picker.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
import {
  SdsColors,
  useNoticeDepartments,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { Tab, Txt } from '@skkuverse/sds';
import { NoticeListPanel } from './NoticeListPanel';
import { DepartmentSelector } from './DepartmentSelector';
import { DepartmentPickerSheet } from './DepartmentPickerSheet';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';

type NoticeTab = 'haksa' | 'hakgwa';

export function NoticesTabScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { data: departments, isLoading, isError, refetch } = useNoticeDepartments();

  const [activeTab, setActiveTab] = useState<NoticeTab>('hakgwa');
  const sheetRef = useRef<BottomSheetModal>(null);

  // Persisted department selection
  const selectedDeptIds = useSettingsStore((s) => s.selectedDeptIds);
  const setSelectedDeptIds = useSettingsStore((s) => s.setSelectedDeptIds);

  // Departments available for the picker (all except skku-main)
  const pickableDepts = useMemo(
    () => departments?.filter((d) => d.id !== 'skku-main') ?? [],
    [departments],
  );

  // Label for the selector row
  const selectorLabel = useMemo(() => {
    if (!departments) return '';
    return selectedDeptIds
      .map((id) => departments.find((d) => d.id === id)?.name ?? id)
      .join(', ');
  }, [departments, selectedDeptIds]);

  const handleOpenSheet = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const handleConfirmDepts = useCallback(
    (ids: string[]) => {
      setSelectedDeptIds(ids);
    },
    [setSelectedDeptIds],
  );

  // Track which tabs have been visited for lazy mounting
  const [visitedTabs, setVisitedTabs] = useState<Set<NoticeTab>>(
    () => new Set<NoticeTab>(['hakgwa']),
  );
  const handleTabChange = useCallback((tab: string) => {
    const t = tab as NoticeTab;
    setVisitedTabs((prev) => {
      if (prev.has(t)) return prev;
      const next = new Set(prev);
      next.add(t);
      return next;
    });
    setActiveTab(t);
  }, []);

  return (
    <BottomSheetModalProvider>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Txt typography="t3" fontWeight="bold" color={SdsColors.grey900}>
            {t('notices.title')}
          </Txt>
        </View>

        {isLoading ? (
          <NoticeListSkeleton />
        ) : isError || !departments || departments.length === 0 ? (
          <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
        ) : (
          <>
            <Tab value={activeTab} onChange={handleTabChange} size="small">
              <Tab.Item value="hakgwa">{t('notices.hakgwa')}</Tab.Item>
              <Tab.Item value="haksa">{t('notices.haksa')}</Tab.Item>
            </Tab>

            <View style={styles.panels}>
              {/* 학사 panel */}
              {visitedTabs.has('haksa') && (
                <View
                  style={[
                    styles.panel,
                    activeTab !== 'haksa' && styles.hidden,
                  ]}
                >
                  <NoticeListPanel deptId="skku-main" />
                </View>
              )}

              {/* 학과 panel */}
              {visitedTabs.has('hakgwa') && (
                <View
                  style={[
                    styles.panel,
                    activeTab !== 'hakgwa' && styles.hidden,
                  ]}
                >
                  <DepartmentSelector
                    label={selectorLabel}
                    onPress={handleOpenSheet}
                  />
                  <NoticeListPanel deptIds={selectedDeptIds} />
                </View>
              )}
            </View>

            <DepartmentPickerSheet
              ref={sheetRef}
              departments={pickableDepts}
              selectedIds={selectedDeptIds}
              onConfirm={handleConfirmDepts}
            />
          </>
        )}
      </View>
    </BottomSheetModalProvider>
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
