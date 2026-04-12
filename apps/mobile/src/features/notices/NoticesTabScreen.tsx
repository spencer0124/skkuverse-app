import { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SdsColors, useNoticeDepartments, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { DepartmentTabBar } from './DepartmentTabBar';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';

export function NoticesTabScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { data: departments, isLoading, isError, refetch } = useNoticeDepartments();

  const defaultDeptId = departments?.[0]?.id ?? 'skku-main';
  const [selectedDeptId, setSelectedDeptId] = useState<string>(defaultDeptId);

  // Track which tabs have been visited to lazily mount panels
  const visitedRef = useRef<Set<string>>(new Set([defaultDeptId]));
  const handleTabChange = (deptId: string) => {
    visitedRef.current.add(deptId);
    setSelectedDeptId(deptId);
  };

  return (
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
          <DepartmentTabBar
            departments={departments}
            value={selectedDeptId}
            onChange={handleTabChange}
          />
          <View style={styles.panels}>
            {departments
              .filter((dept) => visitedRef.current.has(dept.id))
              .map((dept) => (
                <View
                  key={dept.id}
                  style={[
                    styles.panel,
                    dept.id !== selectedDeptId && styles.hidden,
                  ]}
                >
                  <NoticeListPanel deptId={dept.id} />
                </View>
              ))}
          </View>
        </>
      )}
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
