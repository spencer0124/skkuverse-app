import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SdsColors, useNoticeTabs, useT } from '@skkuverse/shared';
import { NoticeNavBar } from './NavigationBar';
import { NoticeListPanel } from './NoticeListPanel';

interface Props {
  deptId: string;
}

export function NoticeListScreen({ deptId }: Props) {
  const { t } = useT();
  const { data: tabsConfig } = useNoticeTabs();

  const deptName = useMemo(() => {
    if (!tabsConfig) return null;
    for (const tab of tabsConfig.tabs) {
      if (tab.tabMode === 'fixed' && tab.fixed?.deptId === deptId) return tab.fixed.name;
      if (tab.tabMode === 'picker' && tab.picker) {
        const dept = tab.picker.departments.find((d) => d.id === deptId);
        if (dept) return dept.name;
      }
    }
    return null;
  }, [tabsConfig, deptId]);

  return (
    <View style={styles.container}>
      <NoticeNavBar title={deptName ?? t('notices.title')} />
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
