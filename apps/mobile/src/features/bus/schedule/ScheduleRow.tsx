/**
 * Schedule row — single timetable entry with timeline dot.
 *
 * Visual states per Flutter bus_campus_screen.dart:
 * - Non-today: all dots grey, no "다음" badge, no past/future distinction
 * - Today past: light grey dot, grey text
 * - Today next: green dot, green text, "다음" badge (green on light-green)
 * - Today future: medium green dot, dark text
 */

import { View, StyleSheet } from 'react-native';
import {
  type ScheduleEntry,
  type RouteBadge,
  hexToColor,
} from '@skkuverse/shared';
import { Txt, Badge } from '@skkuverse/sds';
import { getRouteBadge } from './utils';

/** Flutter color constants */
const DOT_NON_TODAY = '#C9CDD2';
const DOT_PAST = '#E4E6E8';
const DOT_NEXT = '#1A7F4B';
const DOT_FUTURE = '#1BC47D';
const GREEN_BADGE_BG = '#D9F2E6';
const GREEN_BADGE_TEXT = '#1A7F4B';
const NEXT_ROW_BG = '#F0FAF4';
const TEXT_COLOR = '#191F28';
const GREY_LIGHT = '#C9CDD2';

interface ScheduleRowProps {
  entry: ScheduleEntry;
  isPast: boolean;
  isNext: boolean;
  isToday: boolean;
  routeBadges: RouteBadge[];
  showBadge: boolean;
}

export function ScheduleRow({
  entry,
  isPast,
  isNext,
  isToday,
  routeBadges,
  showBadge,
}: ScheduleRowProps) {
  const badge = getRouteBadge(routeBadges, entry.routeType);
  const textColor = isPast ? GREY_LIGHT : isNext ? DOT_NEXT : TEXT_COLOR;
  // Interpret literal \n in notes
  const notes = entry.notes?.replace(/\\n/g, '\n');

  // Dot color: 5 states (Flutter bus_campus_screen.dart:893-906)
  const dotColor = !isToday
    ? DOT_NON_TODAY
    : isPast
      ? DOT_PAST
      : isNext
        ? DOT_NEXT
        : DOT_FUTURE;

  return (
    <View style={[styles.container, isNext && { backgroundColor: NEXT_ROW_BG }]}>
      {/* Timeline dot */}
      <View style={styles.dotColumn}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      </View>

      {/* Time */}
      <Txt
        typography="st10"
        fontWeight={isNext ? 'bold' : 'medium'}
        color={textColor}
        style={styles.time}
      >
        {entry.time}
      </Txt>

      {/* "다음" badge — always reserve space to prevent layout shift */}
      <View style={styles.nextBadgeSlot}>
        {isNext && (
          <Badge
            size="small"
            color={GREEN_BADGE_TEXT}
            backgroundColor={GREEN_BADGE_BG}
            style={{ borderRadius: 20 }}
          >
            다음
          </Badge>
        )}
      </View>

      {/* Route badge */}
      {showBadge && (
        <Badge
          size="tiny"
          color={isPast ? GREY_LIGHT : hexToColor(badge.color)}
          backgroundColor={isPast ? '#F5F6F8' : hexToColor(badge.color) + '1F'}
        >
          {badge.label}
        </Badge>
      )}

      {/* Bus count */}
      <Txt typography="t7" fontWeight="semiBold" color={isPast ? GREY_LIGHT : TEXT_COLOR}>
        {entry.busCount}대
      </Txt>

      {/* Notes */}
      <Txt
        typography="st12"
        color={isPast ? GREY_LIGHT : notes ? '#E87A3B' : GREY_LIGHT}
        fontWeight={notes ? 'semiBold' : 'regular'}
        numberOfLines={2}
        style={styles.notes}
      >
        {notes ?? '—'}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 10,
  },
  dotColumn: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  time: {
    minWidth: 44,
  },
  nextBadgeSlot: {
    width: 42,
    alignItems: 'center',
  },
  notes: {
    flex: 1,
  },
});
