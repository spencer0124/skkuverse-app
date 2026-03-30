/**
 * Hero card — next departure with ETA, bus count column, and badge row.
 *
 * Layout matches Flutter: large time (52px) + separate "운영대수" column,
 * badges in a Wrap (ETA, route, notes), decorative circles.
 *
 * Flutter source: bus_campus_screen.dart (hero card widget)
 */

import { View, StyleSheet } from 'react-native';
import {
  SdsColors,
  type ScheduleEntry,
  type RouteBadge,
} from '@skkuverse/shared';
import { Txt, Badge } from '@skkuverse/sds';
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
      <Txt typography="st12" fontWeight="medium" color="rgba(255,255,255,0.75)">
        {label}
      </Txt>

      {/* Main row: time + bus count column */}
      <View style={styles.mainRow}>
        <Txt
          typography="t1"
          fontWeight="extraBold"
          color={SdsColors.background}
          style={{ fontSize: 52, lineHeight: 52, letterSpacing: -1.5 }}
        >
          {entry.time}
        </Txt>
        <View style={styles.countColumn}>
          <Txt typography="st13" color="rgba(255,255,255,0.75)">
            운영대수
          </Txt>
          <Txt
            typography="st1"
            fontWeight="extraBold"
            color={SdsColors.background}
            style={{ lineHeight: 28 }}
          >
            {entry.busCount}대
          </Txt>
        </View>
      </View>

      {/* Badge row: ETA, route badge, notes */}
      <View style={styles.badgeWrap}>
        {isToday && minutes != null && (
          <Badge
            size="small"
            color={SdsColors.background}
            backgroundColor="rgba(255,255,255,0.22)"
          >
            {`${formatETA(minutes)} 출발`}
          </Badge>
        )}
        {showBadge && badge && (
          <Badge
            size="small"
            color={SdsColors.background}
            backgroundColor="rgba(255,255,255,0.15)"
          >
            {badge.label}
          </Badge>
        )}
        {entry.notes != null && entry.notes.length > 0 && (
          <Badge
            size="small"
            color={SdsColors.background}
            backgroundColor="rgba(255,255,255,0.15)"
          >
            {entry.notes}
          </Badge>
        )}
      </View>
    </>
  );
}

function HeroEnded() {
  return (
    <>
      <Txt typography="st12" fontWeight="medium" color="rgba(255,255,255,0.75)">
        다음 셔틀
      </Txt>
      <Txt
        typography="t1"
        fontWeight="extraBold"
        color={SdsColors.background}
        style={{ fontSize: 52, lineHeight: 52, letterSpacing: -1.5 }}
      >
        운행 종료
      </Txt>
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
  /* Main content row: time + count column */
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  countColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  /* Badge row (Wrap) */
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
});
