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
import { Stack, useRouter } from 'expo-router';
import { DotsThreeIcon } from 'phosphor-react-native';
import { useTransitList, useMainNotice, SdsColors, useT } from '@skkuverse/shared';
import { BusListItemRow } from '@/features/bus/BusListItemRow';
import { NoticeBanner } from '@/features/bus/NoticeBanner';
import { TransitSkeleton } from '@/features/bus/TransitSkeleton';
import { HeaderIconButton } from '@/lib/HeaderIconButton';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

export default function TransitScreen() {
  useTabFocusTracking('transit');
  const router = useRouter();
  const { t } = useT();
  const { data, isLoading } = useTransitList();
  const { data: notice } = useMainNotice();

  return (
    <>
      <Stack.Screen
        options={{
          title: t('nav.transit'),
          ...(Platform.OS === 'ios'
            ? {
                headerBlurEffect: 'systemChromeMaterial',
                headerTransparent: true,
                headerStyle: { backgroundColor: 'transparent' },
                // unstable_headerRightItems: () => [
                //   {
                //     type: 'button' as const,
                //     label: t('settings.title'),
                //     icon: {
                //       type: 'image' as const,
                //       source: require('../../../assets/header-icons/dots-three.png'),
                //       tinted: false,
                //     },
                //     sharesBackground: false,
                //     accessibilityLabel: t('settings.title'),
                //     onPress: () => router.push('/transit/settings' as never),
                //   },
                // ],
              }
            : {
                // headerRight: () => (
                //   <HeaderIconButton
                //     onPress={() => router.push('/transit/settings' as never)}
                //     accessibilityLabel={t('settings.title')}
                //   >
                //     <DotsThreeIcon size={24} color={SdsColors.grey700} weight="bold" />
                //   </HeaderIconButton>
                // ),
              }),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
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
