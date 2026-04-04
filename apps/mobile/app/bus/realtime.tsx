/**
 * Bus realtime screen — live bus tracking on a station timeline.
 *
 * Flow:
 * 1. useLocalSearchParams → groupId
 * 2. useBusConfig(groupId) → BusGroup config
 * 3. Type guard: screenType === 'realtime'
 * 4. useRealtimeData(dataEndpoint, refreshInterval) → polling data
 * 5. Build etaMap from stationEtas for StationRow display
 *
 * Flutter source: lib/features/transit/ui/bus_realtime_screen.dart
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useBusConfig,
  useRealtimeData,
  hexToColor,
  SdsColors,
} from '@skkuverse/shared';
import { NavigationBar } from '@/features/bus/realtime/NavigationBar';
import { TopInfoBar } from '@/features/bus/realtime/TopInfoBar';
import { StationRow } from '@/features/bus/realtime/StationRow';
import { BusMarker } from '@/features/bus/realtime/BusMarker';
import { RefreshFab } from '@/features/bus/realtime/RefreshFab';
import { RealtimeSkeleton } from '@/features/bus/realtime/RealtimeSkeleton';
import { devRewriteInfoUrl } from '@/utils/dev-webview';
import { AdaptiveBanner } from '@/features/ads/AdaptiveBanner';
import { logBusRouteOpen } from '@/services/analytics';

/** Extract info feature URL from config features array */
function getInfoUrl(features: Record<string, unknown>[]): string | undefined {
  const info = features.find((f) => f.type === 'info');
  return info?.url as string | undefined;
}

export default function RealtimeScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { data: config, isLoading: configLoading } = useBusConfig(groupId);

  // Only fetch realtime data when config is loaded and is realtime type
  const isRealtime = config?.screenType === 'realtime';
  const screenConfig = isRealtime ? config.screen : undefined;

  // ── Analytics: log route open ──
  useEffect(() => {
    if (!config || !groupId) return;
    logBusRouteOpen({ routeId: groupId, routeLabel: config.label, screenType: 'realtime' });
  }, [config?.label, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    data: realtimeData,
    dataUpdatedAt,
    refetch,
  } = useRealtimeData(
    screenConfig?.dataEndpoint,
    screenConfig?.refreshInterval,
  );

  // Monotonic counter bumped on each successful poll — used by BusMarker
  // to reset elapsed even when estimatedTime is unchanged between polls.
  const pollGeneration = useRef(0);
  useEffect(() => {
    if (dataUpdatedAt) pollGeneration.current += 1;
  }, [dataUpdatedAt]);

  // Build ETA lookup map: stationIndex → eta string
  const etaMap = useMemo(() => {
    if (!realtimeData?.stationEtas) return new Map<number, string>();
    return new Map(
      realtimeData.stationEtas.map((e) => [e.stationIndex, e.eta]),
    );
  }, [realtimeData?.stationEtas]);

  const themeColor = config
    ? hexToColor(config.card.themeColor, SdsColors.brand)
    : SdsColors.brand;

  // Info button — opens webview with feature info URL
  const serverInfoUrl = screenConfig ? getInfoUrl(screenConfig.features) : undefined;
  const infoUrl = devRewriteInfoUrl(serverInfoUrl, '#/bus/hssc/info');

  const handleInfoPress = useCallback(() => {
    if (!infoUrl || !config) return;
    router.push({
      pathname: '/webview',
      params: {
        title: config.label,
        color: config.card.themeColor,
        url: infoUrl,
      },
    } as never);
  }, [infoUrl, config, router]);

  if (configLoading || !config) {
    return (
      <View style={styles.container}>
        <NavigationBar title="" />
        <RealtimeSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title={config.label} onInfoPress={infoUrl ? handleInfoPress : undefined} />

      <TopInfoBar
        currentTime={realtimeData?.meta?.currentTime ?? '00:00 AM'}
        totalBuses={realtimeData?.meta?.totalBuses ?? 0}
      />

      <View style={styles.divider} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View>
          {/* Station rows (static from config) */}
          {screenConfig?.stations.map((station) => (
            <StationRow
              key={station.index}
              station={station}
              themeColor={config.card.themeColor}
              eta={etaMap.get(station.index)}
            />
          ))}

          {/* Bus markers (positioned absolutely from realtime data) */}
          {realtimeData?.buses.map((bus, i) => (
            <BusMarker
              key={`${bus.carNumber}-${bus.stationIndex}-${i}`}
              bus={bus}
              lastStationIndex={screenConfig?.lastStationIndex ?? 10}
              color={themeColor}
              pollGeneration={pollGeneration.current}
            />
          ))}
        </View>
      </ScrollView>

      <RefreshFab color={themeColor} onPress={() => refetch()} />

      <AdaptiveBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  divider: {
    height: 0.5,
    backgroundColor: SdsColors.grey300,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
});
