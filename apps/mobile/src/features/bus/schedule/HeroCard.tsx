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
  useT,
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
  const { t, tpl } = useT();
  const hasNextBus = entry != null;

  const cardColor = !hasNextBus
    ? HERO_COLOR_ENDED
    : isToday
      ? HERO_COLOR_TODAY
      : HERO_COLOR_FUTURE;

  const heroLabel = isToday ? t('transit.nextShuttle') : t('transit.firstService');
  const fullLabel = serviceLabel ? `${heroLabel} · ${serviceLabel}` : heroLabel;

  return (
    <View style={[styles.container, { backgroundColor: cardColor }]}>
      {hasNextBus ? (
        <HeroContent
          entry={entry}
          routeBadges={routeBadges}
          showBadge={showBadge}
          isToday={isToday}
          label={fullLabel}
          tpl={tpl}
        />
      ) : (
        <HeroEnded t={t} />
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
  tpl,
}: {
  entry: ScheduleEntry;
  routeBadges: RouteBadge[];
  showBadge: boolean;
  isToday: boolean;
  label: string;
  tpl: (key: any, ...args: (string | number)[]) => string;
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
            {tpl('transit.busCount')}
          </Txt>
          <Txt
            typography="st1"
            fontWeight="extraBold"
            color={SdsColors.background}
            style={{ lineHeight: 28 }}
          >
            {tpl('schedule.busUnit', entry.busCount)}
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
            {`${formatETA(minutes, tpl)} ${tpl('transit.departure')}`}
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

function HeroEnded({ t }: { t: (key: any) => string }) {
  return (
    <>
      <Txt typography="st12" fontWeight="medium" color="rgba(255,255,255,0.75)">
        {t('transit.nextShuttle')}
      </Txt>
      <Txt
        typography="t1"
        fontWeight="extraBold"
        color={SdsColors.background}
        style={{ fontSize: 52, lineHeight: 52, letterSpacing: -1.5 }}
      >
        {t('transit.serviceEnded')}
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
