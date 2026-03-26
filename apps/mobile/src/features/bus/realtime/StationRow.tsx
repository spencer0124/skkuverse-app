/**
 * Station row — single station in the realtime route view.
 *
 * Height: 66px (hardcoded, matches Flutter). Left padding: 70px.
 * Timeline: 3px vertical line with station dot.
 * First station hides top line; last station hides bottom line.
 *
 * Flutter source: lib/features/transit/widgets/stationrow.dart
 */

import { View, Text, StyleSheet } from 'react-native';
import { SdsColors, SdsTypo, type RealtimeStation, hexToColor } from '@skkuuniverse/shared';

const STATION_ROW_HEIGHT = 66;
const LEFT_PADDING = 70;
const LINE_WIDTH = 3;
const DOT_SIZE = 12;

interface StationRowProps {
  station: RealtimeStation;
  themeColor: string;
  eta?: string;
}

export function StationRow({ station, themeColor, eta }: StationRowProps) {
  const color = hexToColor(themeColor);

  return (
    <View style={styles.container}>
      {/* Timeline */}
      <View style={styles.timelineContainer}>
        {/* Top line */}
        <View
          style={[
            styles.line,
            { backgroundColor: station.isFirstStation ? SdsColors.background : color },
          ]}
        />

        {/* Station dot */}
        {station.isRotationStation ? (
          <View style={[styles.rotationBadge, { borderColor: color }]}>
            <Text style={[styles.rotationText, { color }]}>회차</Text>
          </View>
        ) : (
          <View style={[styles.dot, { borderColor: color }]}>
            <View style={[styles.dotInner, { backgroundColor: color }]} />
          </View>
        )}

        {/* Bottom line */}
        <View
          style={[
            styles.line,
            { backgroundColor: station.isLastStation ? SdsColors.background : color },
          ]}
        />
      </View>

      {/* Station info */}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.stationName} numberOfLines={1}>
            {station.name}
          </Text>
          {station.transferLines.map((tl) => (
            <View
              key={tl.line}
              style={[
                styles.transferDot,
                { backgroundColor: hexToColor(tl.color) },
              ]}
            >
              <Text style={styles.transferText}>{tl.line}</Text>
            </View>
          ))}
        </View>

        {(station.subtitle || eta) && (
          <Text style={styles.detailText} numberOfLines={1}>
            {[station.subtitle, eta].filter(Boolean).join(' | ')}
          </Text>
        )}
      </View>
    </View>
  );
}

export { STATION_ROW_HEIGHT, LEFT_PADDING };

const styles = StyleSheet.create({
  container: {
    height: STATION_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineContainer: {
    width: LEFT_PADDING,
    height: STATION_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: LINE_WIDTH,
    flex: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    backgroundColor: SdsColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  rotationBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: SdsColors.background,
  },
  rotationText: {
    fontSize: 9,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
    paddingRight: 20,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationName: {
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
  transferDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferText: {
    fontSize: 9,
    fontWeight: '700',
    color: SdsColors.background,
  },
  detailText: {
    fontSize: 11,
    color: SdsColors.grey500,
  },
});
