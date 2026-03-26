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

import { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  useBusConfig,
  useRealtimeData,
  hexToColor,
  SdsColors,
} from '@skkuuniverse/shared';
import { NavigationBar } from '@/features/bus/realtime/NavigationBar';
import { TopInfoBar } from '@/features/bus/realtime/TopInfoBar';
import { StationRow } from '@/features/bus/realtime/StationRow';
import { BusMarker } from '@/features/bus/realtime/BusMarker';
import { RefreshFab } from '@/features/bus/realtime/RefreshFab';
import { RealtimeSkeleton } from '@/features/bus/realtime/RealtimeSkeleton';

export default function RealtimeScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: config, isLoading: configLoading } = useBusConfig(groupId);

  // Only fetch realtime data when config is loaded and is realtime type
  const isRealtime = config?.screenType === 'realtime';
  const screenConfig = isRealtime ? config.screen : undefined;

  const {
    data: realtimeData,
    refetch,
  } = useRealtimeData(
    screenConfig?.dataEndpoint,
    screenConfig?.refreshInterval,
  );

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
      <NavigationBar title={config.label} />

      {realtimeData?.meta && (
        <TopInfoBar
          currentTime={realtimeData.meta.currentTime}
          totalBuses={realtimeData.meta.totalBuses}
        />
      )}

      <View style={styles.divider} />

      <ScrollView style={styles.scrollView}>
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
              key={`${i}-${bus.stationIndex}-${bus.carNumber}`}
              bus={bus}
              lastStationIndex={screenConfig?.lastStationIndex ?? 10}
              color={themeColor}
            />
          ))}
        </View>
      </ScrollView>

      <RefreshFab color={themeColor} onPress={() => refetch()} />
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
});
