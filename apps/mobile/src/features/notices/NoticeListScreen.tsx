import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SdsColors, useNoticeTabs, useT } from '@skkuverse/shared';
import { NoticeListPanel } from './NoticeListPanel';

interface Props {
  sourceId: string;
}

export function NoticeListScreen({ sourceId }: Props) {
  const { t } = useT();
  const { data: tabsConfig } = useNoticeTabs();

  const sourceName = useMemo(() => {
    if (!tabsConfig) return null;
    for (const tab of tabsConfig.tabs) {
      if (tab.tabMode === 'fixed' && tab.fixed?.sourceId === sourceId) return tab.fixed.name;
      if (tab.tabMode === 'picker' && tab.picker) {
        const source = tab.picker.sources.find((s) => s.id === sourceId);
        if (source) return source.name;
      }
    }
    return null;
  }, [tabsConfig, sourceId]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: sourceName ?? t('notices.title') }} />
      <NoticeListPanel sourceId={sourceId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.grey100,
  },
});
