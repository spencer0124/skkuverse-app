/**
 * "학과 새 공지" — top 3 latest notices for the user's selected dept(s).
 *
 * Source of truth (mirrors NoticesTabScreen):
 *   1. `useNotificationStore.preferences.pickerSelections.dept`
 *      — Firestore-synced via CF onPreferencesWrite.
 *   2. `resolvePickerSelection(deptTab, storedIds)` — applies validIds
 *      filter + fallback chain (stored → defaultIds → first source).
 *   3. `useMultiSourceNoticeList({ sourceIds })` — same hook the notices
 *      tab's PickerPanel/NoticeListPanel uses to aggregate across depts.
 *
 * Why not `settings.primaryDeptId`: that field is an onboarding-time
 * temporary; the canonical post-onboarding source is the Firestore-synced
 * picker selection. Using it keeps notices tab + home + notification
 * settings consistent (they all read the same store key).
 *
 * Empty: section returns null (no skeleton, no placeholder) — header
 * pop-in once data lands.
 */

import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CaretDownIcon,
  CaretRightIcon,
  CaretUpIcon,
} from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import {
  SdsColors,
  resolvePickerSelection,
  useMultiSourceNoticeList,
  useNoticeTabs,
  useNotificationStore,
} from '@skkuverse/shared';
import type { NoticeListItem } from '@skkuverse/shared';
import { NoticeRow } from '@/features/notices/NoticeRow';

const DEPT_TAB_KEY = 'dept';
const PREVIEW_COUNT = 3;

export function DeptNoticesSection() {
  const router = useRouter();
  const { data: tabsConfig } = useNoticeTabs();
  const storedIds = useNotificationStore(
    (s) => s.preferences.pickerSelections?.dept,
  );
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  };

  const deptTab = useMemo(
    () => tabsConfig?.tabs.find((t) => t.key === DEPT_TAB_KEY),
    [tabsConfig],
  );

  const selectedIds = useMemo(
    () => (deptTab ? resolvePickerSelection(deptTab, storedIds) : []),
    [deptTab, storedIds],
  );

  const { data: noticeData } = useMultiSourceNoticeList({
    sourceIds: selectedIds,
    enabled: selectedIds.length > 0,
  });

  if (!deptTab || selectedIds.length === 0) return null;

  const notices: NoticeListItem[] =
    noticeData?.pages[0]?.notices.slice(0, PREVIEW_COUNT) ?? [];

  if (notices.length === 0) return null;

  const sources = deptTab.picker?.sources ?? [];
  const isSingleDept = selectedIds.length === 1;
  const headerLabel = (() => {
    if (isSingleDept) {
      const name = sources.find((s) => s.id === selectedIds[0])?.name ?? '';
      return name ? `${name} 공지` : '학과 공지';
    }
    return '학과 공지';
  })();

  const handleNoticePress = (n: NoticeListItem) => {
    router.push(`/notices/${n.sourceId}/${n.articleNo}` as never);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.navigate('/(tabs)/notices' as never)}
          style={({ pressed }) => [
            styles.titleBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${headerLabel} 전체보기`}
        >
          <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
            {headerLabel}
          </Txt>
          <CaretRightIcon size={16} color={SdsColors.grey400} />
        </Pressable>
        <Pressable
          onPress={toggleCollapsed}
          style={({ pressed }) => [
            styles.collapseBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? '펼치기' : '접기'}
        >
          {collapsed ? (
            <CaretUpIcon size={18} color={SdsColors.grey500} />
          ) : (
            <CaretDownIcon size={18} color={SdsColors.grey500} />
          )}
        </Pressable>
      </View>
      {!collapsed ? (
        <View style={styles.card}>
          {notices.map((item, i) => (
            <View key={`${item.sourceId}/${item.articleNo}`}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <NoticeRow
                item={item}
                onPress={handleNoticePress}
                showDepartment={!isSingleDept}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collapseBtn: {
    padding: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: SdsColors.grey100,
    marginHorizontal: 16,
  },
});
