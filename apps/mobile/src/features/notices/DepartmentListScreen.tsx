import { useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SdsColors, useNoticeDepartments, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { Department } from '@skkuverse/shared';
import { DepartmentRow } from './DepartmentRow';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './EmptyState';

export function DepartmentListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { data, isLoading, isError, refetch } = useNoticeDepartments();

  const handleSelect = useCallback(
    (dept: Department) => {
      router.push(`/notices/${dept.id}` as never);
    },
    [router],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Txt typography="t3" fontWeight="bold" color={SdsColors.grey900}>
          {t('notices.title')}
        </Txt>
        <Txt typography="t7" color={SdsColors.grey500}>
          {t('notices.departments')}
        </Txt>
      </View>

      {isLoading ? (
        <NoticeListSkeleton />
      ) : isError ? (
        <NoticeEmptyState message={t('notices.error')} onRetry={refetch} />
      ) : data && data.length > 0 ? (
        <FlatList
          data={data}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DepartmentRow dept={item} onPress={handleSelect} />
          )}
        />
      ) : (
        <NoticeEmptyState message={t('notices.empty')} />
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
    gap: 4,
  },
});
