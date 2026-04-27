/**
 * Transit tab — bus list rendered from API data.
 *
 * Fetches transit list from `GET /ui/home/transitlist` via `useTransitList()`.
 * Each row navigates to either /bus/realtime or /bus/schedule based on
 * the `action.route` field from the API.
 *
 * Flutter source: lib/features/transit/ui/transit_tab.dart
 */

import { Platform, ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTransitList, useMainNotice, SdsColors } from '@skkuverse/shared';
import { BusListItemRow } from '@/features/bus/BusListItemRow';
import { NoticeBanner } from '@/features/bus/NoticeBanner';
import { TransitSkeleton } from '@/features/bus/TransitSkeleton';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

// iOS 26 hosts tabs in UITabBarController (NativeTabs); the safe-area chain
// from the host VC propagates to RN content even with headerShown:false.
// iOS<26 + Android use JS-rendered <Tabs> (see app/(tabs)/_layout.tsx) — that
// path doesn't auto-pad headerless screens, so we apply the top inset
// manually for those platforms only.
const NEEDS_MANUAL_TOP_INSET =
  !(Platform.OS === 'ios' && isLiquidGlassAvailable());

export default function TransitScreen() {
  useTabFocusTracking('transit');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = NEEDS_MANUAL_TOP_INSET ? insets.top : 0;
  const { data, isLoading } = useTransitList();
  const { data: notice } = useMainNotice();

  return (
    <>
      {isLoading ? (
        <View style={[styles.container, { paddingTop: topInset }]}>
          <TransitSkeleton />
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: topInset }]}
          alwaysBounceVertical={false}
          overScrollMode="never"
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
      )}
    </>
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
