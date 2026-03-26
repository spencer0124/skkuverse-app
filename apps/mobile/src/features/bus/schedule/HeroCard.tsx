/**
 * Hero card — next departure with ETA, bus count column, and badge row.
 *
 * Layout matches Flutter: large time (52px) + separate "운영대수" column,
 * badges in a Wrap (ETA, route, notes), decorative circles.
 *
 * Flutter source: bus_campus_screen.dart (hero card widget)
 */

import { View, Text, StyleSheet } from 'react-native';
import {
  SdsColors,
  SdsRadius,
  type ScheduleEntry,
  type RouteBadge,
} from '@skkuuniverse/shared';
import { formatETA, getMinutesUntil } from './utils';

/** Grey for ended, blue-grey for future days, brand green for today */
const HERO_COLOR_TODAY = SdsColors.brand;
const HERO_COLOR_FUTURE = '#8A9AA0';
const HERO_COLOR_ENDED = '#9EA4AA';

interface HeroCardProps {
  entry?: ScheduleEntry;
  routeBadges: RouteBadge[];
  showBadge: boolean;
  isToday: boolean;
  serviceLabel?: string;
}

export function HeroCard({ entry, routeBadges, showBadge, isToday, serviceLabel }: HeroCardProps) {
  const hasNextBus = entry != null;

  const cardColor = !hasNextBus
    ? HERO_COLOR_ENDED
    : isToday
      ? HERO_COLOR_TODAY
      : HERO_COLOR_FUTURE;

  const heroLabel = isToday ? '다음 셔틀' : '첫 운행';
  const fullLabel = serviceLabel ? `${heroLabel} · ${serviceLabel}` : heroLabel;

  return (
    <View style={[styles.container, { backgroundColor: cardColor }]}>
      {/* Decorative circles */}
      <View style={styles.circleTop} />
      <View style={styles.circleBottom} />

      {hasNextBus ? (
        <HeroContent
          entry={entry}
          routeBadges={routeBadges}
          showBadge={showBadge}
          isToday={isToday}
          label={fullLabel}
        />
      ) : (
        <HeroEnded />
      )}
    </View>
  );
}

function HeroContent({
  entry,
  routeBadges,
  showBadge,
  isToday,
  label,
}: {
  entry: ScheduleEntry;
  routeBadges: RouteBadge[];
  showBadge: boolean;
  isToday: boolean;
  label: string;
}) {
  const badge = routeBadges.find((b) => b.id === entry.routeType);
  const minutes = isToday ? getMinutesUntil(entry) : undefined;

  return (
    <>
      {/* Top label */}
      <Text style={styles.heroLabel}>{label}</Text>

      {/* Main row: time + bus count column */}
      <View style={styles.mainRow}>
        <Text style={styles.timeText}>{entry.time}</Text>
        <View style={styles.countColumn}>
          <Text style={styles.countLabel}>운영대수</Text>
          <Text style={styles.countValue}>{entry.busCount}대</Text>
        </View>
      </View>

      {/* Badge row: ETA, route badge, notes */}
      <View style={styles.badgeWrap}>
        {isToday && minutes != null && (
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{formatETA(minutes)} 출발</Text>
          </View>
        )}
        {showBadge && badge && (
          <View style={[styles.heroBadge, styles.heroBadgeLight]}>
            <Text style={styles.heroBadgeText}>{badge.label}</Text>
          </View>
        )}
        {entry.notes != null && entry.notes.length > 0 && (
          <View style={[styles.heroBadge, styles.heroBadgeLight]}>
            <Text style={styles.heroBadgeText}>{entry.notes}</Text>
          </View>
        )}
      </View>
    </>
  );
}

function HeroEnded() {
  return (
    <>
      <Text style={styles.heroLabel}>다음 셔틀</Text>
      <Text style={styles.endedText}>운행 종료</Text>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
    borderRadius: 20,
    minHeight: 120,
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  /* Decorative circles — positioned absolutely, semi-transparent white */
  circleTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleBottom: {
    position: 'absolute',
    bottom: -20,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
  },
  /* Main content row: time + count column */
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 52,
    color: SdsColors.background,
  },
  countColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  countLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  countValue: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 28,
    color: SdsColors.background,
  },
  /* Badge row (Wrap) */
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  heroBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SdsRadius.xs,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroBadgeLight: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: SdsColors.background,
  },
  endedText: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 52,
    color: SdsColors.background,
  },
});
