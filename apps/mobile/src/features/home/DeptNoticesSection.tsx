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
  resolvePickerSelection,
  useAuthStore,
  useMultiSourceNoticeList,
  useNoticeTabs,
  useNotificationStore,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { HomeOnboardingGateCard } from './HomeOnboardingGateCard';
import type { NoticeListItem } from '@skkuverse/shared';
import { NoticeRow } from '@/features/notices/NoticeRow';
import { logHomeContentSelect } from '@/services/analytics';

const DEPT_TAB_KEY = 'dept';
const PREVIEW_COUNT = 3;

export function DeptNoticesSection() {
  const router = useRouter();
  const { t, tpl } = useT();
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

  // Auth/onboarding gate — hooks must be called unconditionally (after all above hooks)
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);
  const showOnboardingGate = isAnonymous || !onboardingCompleted;

  if (showOnboardingGate) {
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
            {t('home.notices.deptTitle')}
          </Txt>
          <Pressable
            onPress={() => {
              logHomeContentSelect({ content_type: 'notice_more', item_id: 'dept' });
              router.navigate('/(tabs)/notices' as never);
            }}
            style={({ pressed }) => [
              styles.viewAllBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.notices.deptTitle')} ${t('common.viewAll')}`}
          >
            <Txt typography="t7" color={SdsColors.grey500}>
              {t('common.viewAll')}
            </Txt>
            <CaretRightIcon size={12} color={SdsColors.grey400} />
          </Pressable>
        </View>
        <HomeOnboardingGateCard />
      </View>
    );
  }

  if (!deptTab || selectedIds.length === 0) return null;

  const notices: NoticeListItem[] =
    noticeData?.pages[0]?.notices.slice(0, PREVIEW_COUNT) ?? [];

  if (notices.length === 0) return null;

  const sources = deptTab.picker?.sources ?? [];
  const isSingleDept = selectedIds.length === 1;
  const headerLabel = (() => {
    if (isSingleDept) {
      const name = sources.find((s) => s.id === selectedIds[0])?.name ?? '';
      return name ? tpl('home.notices.deptTitleNamed', name) : t('home.notices.deptTitle');
    }
    return t('home.notices.deptTitle');
  })();

  const handleNoticePress = (n: NoticeListItem) => {
    logHomeContentSelect({
      content_type: 'notice_row',
      item_id: `${n.sourceId}/${n.articleNo}`,
    });
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
          onPress={() => {
            logHomeContentSelect({ content_type: 'notice_more', item_id: 'dept' });
            router.navigate('/(tabs)/notices' as never);
          }}
          style={({ pressed }) => [
            styles.viewAllBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${headerLabel} ${t('common.viewAll')}`}
        >
          <Txt typography="t7" color={SdsColors.grey500}>
            {t('common.viewAll')}
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
          variant="card"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 36,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
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
