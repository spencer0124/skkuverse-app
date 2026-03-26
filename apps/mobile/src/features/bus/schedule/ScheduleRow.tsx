/**
 * Schedule row — single timetable entry with timeline dot.
 *
 * Visual states per Flutter bus_campus_screen.dart:
 * - Non-today: all dots grey, no "다음" badge, no past/future distinction
 * - Today past: light grey dot, grey text
 * - Today next: green dot, green text, "다음" badge (green on light-green)
 * - Today future: medium green dot, dark text
 */

import { View, Text, StyleSheet } from 'react-native';
import {
  SdsTypo,
  type ScheduleEntry,
  type RouteBadge,
  hexToColor,
} from '@skkuuniverse/shared';
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
      <Text style={[styles.time, { color: textColor, fontWeight: isNext ? '700' : '500' }]}>
        {entry.time}
      </Text>

      {/* "다음" badge — always reserve space to prevent layout shift */}
      <View style={styles.nextBadgeSlot}>
        {isNext && (
          <View style={styles.nextBadge}>
            <Text style={styles.nextBadgeText}>다음</Text>
          </View>
        )}
      </View>

      {/* Route badge */}
      {showBadge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: isPast ? '#F5F6F8' : hexToColor(badge.color) + '1F',
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isPast ? GREY_LIGHT : hexToColor(badge.color) },
            ]}
          >
            {badge.label}
          </Text>
        </View>
      )}

      {/* Bus count */}
      <Text style={[styles.count, { color: isPast ? GREY_LIGHT : TEXT_COLOR }]}>
        {entry.busCount}대
      </Text>

      {/* Notes */}
      <Text
        style={[
          styles.notes,
          {
            color: isPast ? GREY_LIGHT : notes ? '#E87A3B' : GREY_LIGHT,
            fontWeight: notes ? '600' : '400',
          },
        ]}
        numberOfLines={2}
      >
        {notes ?? '—'}
      </Text>
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
    fontSize: 16,
    minWidth: 44,
  },
  nextBadgeSlot: {
    width: 42,
    alignItems: 'center',
  },
  nextBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: GREEN_BADGE_BG,
  },
  nextBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN_BADGE_TEXT,
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
    fontWeight: '600',
  },
  notes: {
    flex: 1,
    fontSize: 12,
  },
});
