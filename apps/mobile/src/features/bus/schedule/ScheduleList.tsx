/**
 * Schedule list — timetable with timeline dots.
 *
 * Renders ScheduleRow for each entry, highlighting the next departure.
 *
 * Flutter source: bus_campus_screen.dart (schedule list)
 */

import { View, StyleSheet } from 'react-native';
import type { ScheduleEntry, RouteBadge } from '@skkuuniverse/shared';
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
    <View style={styles.container}>
      {entries.map((entry) => (
        <ScheduleRow
          key={entry.index}
          entry={entry}
          isPast={isPastBus(entry, isToday)}
          isNext={entry.index === nextEntryIndex}
          routeBadges={routeBadges}
          showBadge={showBadge}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingBottom: 32,
  },
});
