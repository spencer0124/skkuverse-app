/**
 * Hero card — next departure with ETA and route badge.
 *
 * Flutter source: bus_campus_screen.dart (hero card widget)
 */

import { View, Text, StyleSheet } from 'react-native';
import {
  SdsColors,
  SdsTypo,
  SdsRadius,
  type ScheduleEntry,
  type RouteBadge,
  hexToColor,
} from '@skkuuniverse/shared';
import { formatETA, getMinutesUntil } from './utils';

/** Grey for ended, blue-grey for future days, brand green for today */
const HERO_COLOR_TODAY = SdsColors.brand;
const HERO_COLOR_FUTURE = '#8A9AA0';
const HERO_COLOR_ENDED = SdsColors.grey500;

interface HeroCardProps {
  entry?: ScheduleEntry;
  routeBadges: RouteBadge[];
  showBadge: boolean;
  isToday: boolean;
}

export function HeroCard({ entry, routeBadges, showBadge, isToday }: HeroCardProps) {
  const hasNextBus = entry != null;

  const cardColor = !hasNextBus
    ? HERO_COLOR_ENDED
    : isToday
      ? HERO_COLOR_TODAY
      : HERO_COLOR_FUTURE;

  const heroLabel = isToday ? '다음 셔틀' : '첫 운행';

  return (
    <View style={[styles.container, { backgroundColor: cardColor }]}>
      {hasNextBus ? (
        <HeroContent
          entry={entry}
          routeBadges={routeBadges}
          showBadge={showBadge}
          isToday={isToday}
          label={heroLabel}
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
      <Text style={styles.heroLabel}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.timeText}>{entry.time}</Text>
        {entry.busCount > 1 && (
          <Text style={styles.countText}>{entry.busCount}대</Text>
        )}
        {showBadge && badge && (
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
        )}
      </View>
      {isToday && minutes != null && (
        <View style={styles.etaRow}>
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>{formatETA(minutes)}</Text>
          </View>
        </View>
      )}
      {entry.notes != null && (
        <Text style={styles.notes}>{entry.notes}</Text>
      )}
    </>
  );
}

function HeroEnded() {
  return (
    <>
      <Text style={styles.heroLabel}>오늘의 운행</Text>
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
  },
  heroLabel: {
    fontSize: SdsTypo.sub12.fontSize,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: SdsTypo.t2.fontSize,
    lineHeight: SdsTypo.t2.lineHeight,
    fontWeight: '700',
    color: SdsColors.background,
  },
  countText: {
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    color: 'rgba(255,255,255,0.7)',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: SdsColors.background,
  },
  etaRow: {
    flexDirection: 'row',
  },
  etaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: SdsRadius.xs,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  etaText: {
    fontSize: SdsTypo.sub12.fontSize,
    fontWeight: '700',
    color: SdsColors.background,
  },
  notes: {
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    color: 'rgba(255,255,255,0.7)',
  },
  endedText: {
    fontSize: SdsTypo.t2.fontSize,
    lineHeight: SdsTypo.t2.lineHeight,
    fontWeight: '700',
    color: SdsColors.background,
  },
});
