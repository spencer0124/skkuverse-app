/**
 * Top-level notices tab — 9-tab scrollable layout.
 *
 * 학과: merged list from user-selected departments (via useMultiDeptNoticeList)
 * 도서관: merged list from user-selected libraries (via useMultiDeptNoticeList)
 * 학사 / 장학 / 취업 / 모집 / 행사 / 기숙사 / 일반: single dept via useNoticeList
 *
 * Department / library selection is persisted in settingsStore and opened via
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
import { NoticeSelector } from './NoticeSelector';
import { NoticePickerSheet } from './NoticePickerSheet';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';

// ── Tab configuration ──

const NOTICE_TABS = [
  { key: 'hakgwa', labelKey: 'notices.hakgwa' },
  { key: 'haksa', labelKey: 'notices.haksa' },
  { key: 'scholarship', labelKey: 'notices.scholarship' },
  { key: 'career', labelKey: 'notices.career' },
  { key: 'recruit', labelKey: 'notices.recruit' },
  { key: 'event', labelKey: 'notices.event' },
  { key: 'library', labelKey: 'notices.library' },
  { key: 'dorm', labelKey: 'notices.dorm' },
  { key: 'general', labelKey: 'notices.general' },
] as const;

type NoticeTab = (typeof NOTICE_TABS)[number]['key'];

/** Tabs that use multi-dept picker */
const MULTI_TABS = new Set<NoticeTab>(['hakgwa', 'library']);

/** Maps single-dept tabs to their dept ID. */
const TAB_DEPT_ID: Record<Exclude<NoticeTab, 'hakgwa' | 'library'>, string> = {
  haksa: 'skku-notice02',
  scholarship: 'skku-notice06',
  career: 'skku-notice04',
  recruit: 'skku-notice05',
  event: 'skku-notice07',
  dorm: 'dorm-seoul',
  general: 'skku-general',
};

/** Library dept IDs — names are resolved from the server department list. */
const LIBRARY_DEPT_IDS = ['lib-all', 'lib-seoul', 'lib-suwon'];

export function NoticesTabScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { data: departments, isLoading, isError, refetch } = useNoticeDepartments();

  const [activeTab, setActiveTab] = useState<NoticeTab>('hakgwa');
  const deptSheetRef = useRef<BottomSheetModal>(null);
  const libSheetRef = useRef<BottomSheetModal>(null);

  // ── Department (학과) picker state ──
  const selectedDeptIds = useSettingsStore((s) => s.selectedDeptIds);
  const setSelectedDeptIds = useSettingsStore((s) => s.setSelectedDeptIds);

  // Departments available for the 학과 picker (exclude skku-main and lib-*)
  const pickableDepts = useMemo(
    () => departments?.filter((d) => d.id !== 'skku-main' && !d.id.startsWith('lib-')) ?? [],
    [departments],
  );

  // Library items from server department list, filtered by LIBRARY_DEPT_IDS
  const pickableLibs = useMemo(() => {
    if (!departments) return [];
    return LIBRARY_DEPT_IDS
      .map((id) => departments.find((d) => d.id === id))
      .filter((d): d is NonNullable<typeof d> => d != null);
  }, [departments]);

  const deptSelectorLabel = useMemo(() => {
    if (!departments) return '';
    return selectedDeptIds
      .map((id) => departments.find((d) => d.id === id)?.name ?? id)
      .join(', ');
  }, [departments, selectedDeptIds]);

  const handleOpenDeptSheet = useCallback(() => {
    deptSheetRef.current?.present();
  }, []);

  const handleConfirmDepts = useCallback(
    (ids: string[]) => {
      setSelectedDeptIds(ids);
    },
    [setSelectedDeptIds],
  );

  // ── Library (도서관) picker state ──
  const selectedLibIds = useSettingsStore((s) => s.selectedLibIds);
  const setSelectedLibIds = useSettingsStore((s) => s.setSelectedLibIds);

  const libSelectorLabel = useMemo(() => {
    if (!departments) return '';
    return selectedLibIds
      .map((id) => departments.find((d) => d.id === id)?.name ?? id)
      .join(', ');
  }, [departments, selectedLibIds]);

  const handleOpenLibSheet = useCallback(() => {
    libSheetRef.current?.present();
  }, []);

  const handleConfirmLibs = useCallback(
    (ids: string[]) => {
      setSelectedLibIds(ids);
    },
    [setSelectedLibIds],
  );

  // ── Tab lazy-mounting ──
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
            <Tab value={activeTab} onChange={handleTabChange} size="small" fluid>
              {NOTICE_TABS.map(({ key, labelKey }) => (
                <Tab.Item key={key} value={key}>
                  {t(labelKey)}
                </Tab.Item>
              ))}
            </Tab>

            <View style={styles.panels}>
              {/* 학과 panel (multi-dept with picker) */}
              {visitedTabs.has('hakgwa') && (
                <View
                  style={[
                    styles.panel,
                    activeTab !== 'hakgwa' && styles.hidden,
                  ]}
                >
                  <NoticeSelector
                    label={deptSelectorLabel}
                    onPress={handleOpenDeptSheet}
                  />
                  <NoticeListPanel deptIds={selectedDeptIds} />
                </View>
              )}

              {/* 도서관 panel (multi-lib with picker) */}
              {visitedTabs.has('library') && (
                <View
                  style={[
                    styles.panel,
                    activeTab !== 'library' && styles.hidden,
                  ]}
                >
                  <NoticeSelector
                    label={libSelectorLabel}
                    onPress={handleOpenLibSheet}
                  />
                  <NoticeListPanel deptIds={selectedLibIds} />
                </View>
              )}

              {/* All other tabs — single dept each */}
              {NOTICE_TABS.map(({ key }) => {
                if (MULTI_TABS.has(key)) return null;
                if (!visitedTabs.has(key)) return null;
                return (
                  <View
                    key={key}
                    style={[
                      styles.panel,
                      activeTab !== key && styles.hidden,
                    ]}
                  >
                    <NoticeListPanel deptId={TAB_DEPT_ID[key as Exclude<NoticeTab, 'hakgwa' | 'library'>]} />
                  </View>
                );
              })}
            </View>

            {/* Department picker sheet */}
            <NoticePickerSheet
              ref={deptSheetRef}
              items={pickableDepts}
              selectedIds={selectedDeptIds}
              onConfirm={handleConfirmDepts}
            />

            {/* Library picker sheet */}
            <NoticePickerSheet
              ref={libSheetRef}
              items={pickableLibs}
              selectedIds={selectedLibIds}
              onConfirm={handleConfirmLibs}
              title={t('notices.selectLib')}
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
