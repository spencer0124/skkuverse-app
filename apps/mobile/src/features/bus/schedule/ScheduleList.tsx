/**
 * Schedule list — timetable with column header, timeline dots, and row separators.
 *
 * Renders ScheduleRow for each entry, highlighting the next departure.
 * Wrapped in a white rounded card with header and footer.
 *
 * Flutter source: bus_campus_screen.dart (schedule list)
 */

import { View, StyleSheet } from 'react-native';
import { SdsColors, type ScheduleEntry, type RouteBadge } from '@skkuuniverse/shared';
import { Txt } from '@skkuuniverse/sds';
import { ScheduleRow } from './ScheduleRow';
import { isPastBus, hasMultipleRouteTypes } from './utils';

interface ScheduleListProps {
  entries: ScheduleEntry[];
  routeBadges: RouteBadge[];
  isToday: boolean;
  nextEntryIndex?: number;
}

export function ScheduleList({
  entries,
  routeBadges,
  isToday,
  nextEntryIndex,
}: ScheduleListProps) {
  const showBadge = hasMultipleRouteTypes(entries);

  return (
    <View style={styles.card}>
      {/* Column header — widths must match ScheduleRow columns */}
      <View style={styles.header}>
        <View style={styles.dotColumnHeader} />
        <Txt typography="st13" fontWeight="semiBold" color={SdsColors.grey400} style={styles.headerTime}>
          시간
        </Txt>
        <View style={styles.headerBadgeSlot} />
        {showBadge && (
          <Txt typography="st13" fontWeight="semiBold" color={SdsColors.grey400}>
            노선
          </Txt>
        )}
        <Txt typography="st13" fontWeight="semiBold" color={SdsColors.grey400}>
          대수
        </Txt>
        <Txt typography="st13" fontWeight="semiBold" color={SdsColors.grey400} style={styles.headerNotes}>
          특이사항
        </Txt>
      </View>

      {/* Schedule rows */}
      {entries.map((entry, index) => (
        <View key={entry.index}>
          <ScheduleRow
            entry={entry}
            isPast={isPastBus(entry, isToday)}
            isNext={isToday && entry.index === nextEntryIndex}
            isToday={isToday}
            routeBadges={routeBadges}
            showBadge={showBadge}
          />
          {/* Row separator (except last) */}
          {index < entries.length - 1 && <View style={styles.separator} />}
        </View>
      ))}

      {/* Footer count */}
      <Txt typography="st12" color={SdsColors.grey400} textAlign="center" style={styles.footer}>
        시간표 · 총 {entries.length}편
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: SdsColors.background,
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 9,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SdsColors.grey100,
    gap: 10,
  },
  dotColumnHeader: {
    width: 16,
  },
  headerTime: {
    minWidth: 44,
  },
  headerBadgeSlot: {
    width: 42,
  },
  headerNotes: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F5F6F8',
    marginLeft: 20,
  },
  footer: {
    paddingVertical: 12,
  },
});
