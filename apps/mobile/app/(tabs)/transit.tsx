/**
 * Transit tab — bus list rendered from API data.
 *
 * Fetches transit list from `GET /ui/home/transitlist` via `useTransitList()`.
 * Each row navigates to either /bus/realtime or /bus/schedule based on
 * the `action.route` field from the API.
 *
 * Flutter source: lib/features/transit/ui/transit_tab.dart
 */

import { ScrollView, View, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTransitList, useMainNotice, SdsColors } from '@skkuverse/shared';
import { BusListItemRow } from '@/features/bus/BusListItemRow';
import { NoticeBanner } from '@/features/bus/NoticeBanner';
import { TransitSkeleton } from '@/features/bus/TransitSkeleton';

export default function TransitScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useTransitList();
  const { data: notice } = useMainNotice();

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
      alwaysBounceVertical={false}
      overScrollMode="never"
    >
      <Text style={{ textAlign: 'center', padding: 8, color: '#888' }}>OTA v6 - fingerprint 테스트</Text>
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
