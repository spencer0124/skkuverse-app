/**
 * Transit tab — bus list rendered from API data.
 *
 * Fetches transit list from `GET /ui/home/transitlist` via `useTransitList()`.
 * Each row navigates to either /bus/realtime or /bus/schedule based on
 * the `action.route` field from the API.
 *
 * Flutter source: lib/features/transit/ui/transit_tab.dart
 */

import { useCallback } from 'react';
import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTransitList, useMainNotice, SdsColors } from '@skkuuniverse/shared';
import { BusListItemRow } from '@/features/bus/BusListItemRow';
import { NoticeBanner } from '@/features/bus/NoticeBanner';
import { TransitSkeleton } from '@/features/bus/TransitSkeleton';

export default function TransitScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, isFetching, refresh } = useTransitList();
  const { data: notice } = useMainNotice();

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TransitSkeleton />
      </View>
    );
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
      {notice && <NoticeBanner notice={notice} />}

      {data?.map((item) => (
        <BusListItemRow
          key={item.groupId}
          item={item}
          onPress={() => {
            const route = item.action.route === '/bus/schedule'
              ? '/bus/schedule'
              : '/bus/realtime';
            router.push({
              pathname: route,
              params: { groupId: item.action.groupId },
            } as never);
          }}
        />
      ))}

      {/* Bottom spacing for tab bar clearance */}
      <View style={styles.bottomSpacer} />
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
  bottomSpacer: {
    height: 80,
  },
});
