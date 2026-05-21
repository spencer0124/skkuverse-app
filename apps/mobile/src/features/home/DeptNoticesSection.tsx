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

import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretRightIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import {
  SdsColors,
  SdsShadows,
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
        <Txt
          typography="t4"
          fontWeight="bold"
          color={SdsColors.grey900}
          numberOfLines={1}
          style={styles.title}
        >
          {headerLabel}
        </Txt>
        <Pressable
          onPress={() => router.navigate('/(tabs)/notices' as never)}
          style={({ pressed }) => [
            styles.viewAllBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${headerLabel} 전체보기`}
        >
          <Txt typography="t7" color={SdsColors.grey500}>
            전체보기
          </Txt>
          <CaretRightIcon size={12} color={SdsColors.grey400} />
        </Pressable>
      </View>
      {notices.map((item) => (
        <NoticeRow
          key={`${item.sourceId}/${item.articleNo}`}
          item={item}
          onPress={handleNoticePress}
          showDepartment={!isSingleDept}
          compact
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 20,
    // 8 + row's own paddingVertical (12) = 20px effective bottom — matches
    // paddingTop visually without double-padding the last row.
    paddingBottom: 8,
    paddingHorizontal: 20,
    // Clips ListRow press underlay flash at rounded corners.
    overflow: 'hidden',
    boxShadow: SdsShadows.card.boxShadow,
    ...SdsShadows.card.legacy,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    marginRight: 12,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
});
