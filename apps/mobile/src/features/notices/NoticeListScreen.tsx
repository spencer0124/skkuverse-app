import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SdsColors, useNoticeDepartments, useT } from '@skkuverse/shared';
import { NoticeNavBar } from './NavigationBar';
import { NoticeListPanel } from './NoticeListPanel';

interface Props {
  deptId: string;
}

export function NoticeListScreen({ deptId }: Props) {
  const { t } = useT();
  const { data: depts } = useNoticeDepartments();
  const dept = useMemo(() => depts?.find((d) => d.id === deptId), [depts, deptId]);

  return (
    <View style={styles.container}>
      <NoticeNavBar title={dept?.name ?? t('notices.title')} />
      <NoticeListPanel deptId={deptId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.grey100,
  },
});
