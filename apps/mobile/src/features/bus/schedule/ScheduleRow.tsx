/**
 * Schedule row — single timetable entry with timeline dot.
 *
 * "Next" row: green50 background highlight. Past rows: grey text.
 *
 * Flutter source: bus_campus_screen.dart (schedule row widget)
 */

import { View, Text, StyleSheet } from 'react-native';
import {
  SdsColors,
  SdsTypo,
  type ScheduleEntry,
  type RouteBadge,
  hexToColor,
} from '@skkuuniverse/shared';

interface ScheduleRowProps {
  entry: ScheduleEntry;
  isPast: boolean;
  isNext: boolean;
  routeBadges: RouteBadge[];
  showBadge: boolean;
}

export function ScheduleRow({
  entry,
  isPast,
  isNext,
  routeBadges,
  showBadge,
}: ScheduleRowProps) {
  const badge = routeBadges.find((b) => b.id === entry.routeType);
  const textColor = isPast ? SdsColors.grey400 : SdsColors.grey900;

  return (
    <View style={[styles.container, isNext && styles.nextHighlight]}>
      {/* Timeline dot */}
      <View style={styles.dotColumn}>
        <View
          style={[
            styles.dot,
            { backgroundColor: isPast ? SdsColors.grey300 : SdsColors.brand },
          ]}
        />
      </View>

      {/* Time */}
      <Text style={[styles.time, { color: textColor }]}>{entry.time}</Text>

      {/* Badge */}
      {showBadge && badge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: hexToColor(badge.color) + (isPast ? '0D' : '1F'),
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isPast ? SdsColors.grey400 : hexToColor(badge.color) },
            ]}
          >
            {badge.label}
          </Text>
        </View>
      )}

      {/* Bus count */}
      {entry.busCount > 1 && (
        <Text style={[styles.count, { color: isPast ? SdsColors.grey400 : SdsColors.grey600 }]}>
          {entry.busCount}대
        </Text>
      )}

      {/* Notes */}
      {entry.notes != null && (
        <Text
          style={[styles.notes, { color: isPast ? SdsColors.grey400 : SdsColors.grey500 }]}
          numberOfLines={1}
        >
          {entry.notes}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  nextHighlight: {
    backgroundColor: SdsColors.green50,
  },
  dotColumn: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  time: {
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: '600',
    minWidth: 44,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  count: {
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
  },
  notes: {
    flex: 1,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
  },
});
