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
import { Platform, ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { BusIcon } from 'phosphor-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTransitList, useMainNotice, SdsColors, useEngagementStore, useT } from '@skkuverse/shared';
import { BusListItemRow } from '@/features/bus/BusListItemRow';
import { NoticeBanner } from '@/features/bus/NoticeBanner';
import { TransitSkeleton } from '@/features/bus/TransitSkeleton';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';
import { useReviewPrompt } from '@/features/feedback/useReviewPrompt';
import { DEV_ALWAYS_SHOW, SEVEN_DAYS_MS } from '@/features/feedback/useReviewPromptGate';

// iOS 26 NativeTabs auto-applies UIKit `automatic` contentInsetAdjustmentBehavior
// to the FIRST ScrollView in the screen's view tree (resolved by
// RNSScrollViewFinder at mount). The status-bar inset gets baked into
// contentInset.top — no manual paddingTop needed. But the chain root must be a
// ScrollView at MOUNT time: if the loading branch first renders a <View>, the
// finder caches "no scrollable root" and never re-resolves once data lands.
// So the skeleton lives INSIDE the same ScrollView, not as a sibling branch.
//
// iOS<26 + Android use JS-rendered <Tabs> which doesn't auto-pad headerless
// screens — apply useSafeAreaInsets().top manually for those platforms only.
const NEEDS_MANUAL_TOP_INSET =
  !(Platform.OS === 'ios' && isLiquidGlassAvailable());

const SHUTTLE_VISIT_THRESHOLD = 3;

export default function TransitScreen() {
  useTabFocusTracking('transit');
  const router = useRouter();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const topInset = NEEDS_MANUAL_TOP_INSET ? insets.top : 0;
  const { data, isLoading } = useTransitList();
  const { data: notice } = useMainNotice();

  // Review-prompt funnel for the shuttle timetable surface.
  const review = useReviewPrompt({
    reason: 'inja_shuttle',
    minInstallAgeMs: SEVEN_DAYS_MS,
    title: t('feedback.reviewPrompt.shuttleTitle'),
    icon: <BusIcon size={32} color="#1f3d2e" weight="fill" />,
  });

  // Stable ref to the gate trigger — useReviewPrompt returns a new `review`
  // object on every render, so we destructure the stable memoized function.
  const { triggerIfEligible: triggerShuttleReview } = review;

  // Detect "came back from schedule screen" via the armed flag.
  // useFocusEffect fires on every focus, including unrelated tab switches, so
  // we use the shuttlePromptArmed flag (set on schedule mount, consumed here)
  // to confirm the user actually visited a schedule screen this session leg.
  useFocusEffect(
    useCallback(() => {
      const store = useEngagementStore.getState();
      const eligible =
        DEV_ALWAYS_SHOW ||
        (store.shuttlePromptArmed && store.injaShuttleVisitCount >= SHUTTLE_VISIT_THRESHOLD);
      if (eligible) {
        triggerShuttleReview(store.injaShuttleVisitCount);
      }
      store.consumeShuttleArm();
    }, [triggerShuttleReview]),
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: topInset }]}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
      {isLoading ? (
        <TransitSkeleton />
      ) : (
        <>
          {notice && <NoticeBanner notice={notice} />}

          {data?.map((item) => (
            <BusListItemRow
              key={item.groupId}
              item={item}
              onPress={() => {
                // bus_route_open fires from bus/schedule.tsx / bus/realtime.tsx
                // on mount — do NOT duplicate here.
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
        </>
      )}
    </ScrollView>
      {review.Host}
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
