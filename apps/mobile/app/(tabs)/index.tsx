/**
 * Campus tab — server-driven UI rendered from SDUI sections.
 *
 * Fetches sections from `GET /ui/home/campus` via `useCampusSections()`.
 * Falls back to default buttons on API failure. Pull-to-refresh supported.
 * Map overlay will be added in Phase 6.6.
 *
 * Flutter source: lib/features/campus_map/ui/snappingsheet/option_campus.dart
 */

import { useCallback } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCampusSections, SdsColors } from '@skkuuniverse/shared';
import { SduiSectionList } from '@/sdui/renderer';
import { CampusSkeleton } from '@/sdui/widgets/CampusSkeleton';

export default function CampusScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isFetching, refresh } = useCampusSections();

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (isLoading) {
    return <CampusSkeleton />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={onRefresh}
          tintColor={SdsColors.grey400}
        />
      }
    >
      {data && <SduiSectionList sections={data.sections} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  content: {
    paddingBottom: 32,
  },
});
