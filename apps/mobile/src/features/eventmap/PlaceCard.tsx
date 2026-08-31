/**
 * A place, drawn as a card.
 *
 * **A fixed layout, deliberately.** This replaced `CardRenderer`, which drew
 * whatever slots a server-declared `cardTemplateId` resolved to. The template
 * tier is gone from the wire — the marker carries `subtitle`, `hours`, `fields`
 * and `actions` directly, in authored order — so the only thing the templates
 * were still buying was the ability to reorder four rows from the server, at
 * the cost of a slot union, a resolver and a publish pipeline to keep them in
 * step. `fields` preserves the one ordering that was ever ops-driven.
 *
 * The open/closed pill is derived here rather than carried, and that is the same
 * decision the wire made when it dropped `status`: it was only ever a cache of
 * `isOpenNow`, and caching it made a place's openness disagree with its own
 * hours the moment the clock passed a boundary.
 *
 * `now` is a prop rather than a `Date.now()` call in the body, because the card
 * must re-derive when the clock crosses a boundary and nothing else changes —
 * `useWindowClock` upstream owns that timer. Reading the clock here would make
 * the pill correct only until the next render for any other reason.
 */

import { StyleSheet, View } from 'react-native';
import {
  isOpenNow,
  nextOpeningAfter,
  pickI18nText,
  SdsColors,
  useSettingsStore,
  useT,
  type MapOverlay,
  type TimeWindow,
  type TranslationKey,
  type AppLanguage,
} from '@skkuverse/shared';
import { Badge, Txt } from '@skkuverse/sds';

type Openness = 'open' | 'upcoming' | 'closed';

const STATUS_LABEL: Record<Openness, TranslationKey> = {
  open: 'eventmap.status.open',
  upcoming: 'eventmap.status.upcoming',
  closed: 'eventmap.status.closed',
};

const STATUS_STYLE: Record<Openness, { color: string; backgroundColor: string }> = {
  open: { color: SdsColors.brand, backgroundColor: SdsColors.grey100 },
  upcoming: { color: SdsColors.grey700, backgroundColor: SdsColors.grey100 },
  closed: { color: SdsColors.grey500, backgroundColor: SdsColors.grey100 },
};

/**
 * Three states out of two functions.
 *
 * There is no fourth. `unknown` existed because the server could null both
 * bounds to mean "do not recompute", which is exactly the ambiguity the wire
 * removed: an empty `hours` is ALWAYS OPEN and nothing else, and a cancelled
 * place is not served at all.
 */
function opennessOf(hours: readonly TimeWindow[], now: number): Openness {
  if (isOpenNow(hours, now)) return 'open';
  return nextOpeningAfter(hours, now) === null ? 'closed' : 'upcoming';
}

const HH_MM: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
const M_D: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric' };

/** BCP-47 tags for the app's three languages, for `toLocaleString`. */
const LOCALE: Record<AppLanguage, string> = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN' };

/**
 * Opening hours as one line.
 *
 * The server used to ship a formatted `hoursLabel` beside the instants. It does
 * not any more, and that is the right side of the trade: a formatted string
 * cannot follow the device's locale or its 24-hour setting, and the instants
 * were already on the wire for the arithmetic.
 *
 * The date is shown only when there is more than one window, which is exactly
 * when it disambiguates — a 주점 open on both festival nights needs to say which
 * night, a single-window booth does not. A window crossing midnight ends on the
 * next day's date, so `18:00–00:00` reads correctly without a special case.
 */
function formatHours(hours: readonly TimeWindow[], lang: AppLanguage, always: string): string {
  if (hours.length === 0) return always;
  const locale = LOCALE[lang];
  return hours
    .map((w) => {
      const start = new Date(w.startAt);
      const end = new Date(w.endAt);
      const span = `${start.toLocaleTimeString(locale, HH_MM)}–${end.toLocaleTimeString(locale, HH_MM)}`;
      return hours.length > 1 ? `${start.toLocaleDateString(locale, M_D)} ${span}` : span;
    })
    .join(', ');
}

interface PlaceCardProps {
  place: MapOverlay;
  /** From `useWindowClock`. Changes at each opening or closing boundary. */
  now: number;
  /** `compact` drops the field rows — the list needs scannable rows. */
  variant?: 'full' | 'compact';
}

export function PlaceCard({ place, now, variant = 'full' }: PlaceCardProps) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const compact = variant === 'compact';
  const openness = opennessOf(place.hours, now);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Txt typography={compact ? 't6' : 't5'} fontWeight="bold" style={styles.title}>
          {pickI18nText(place.text, lang)}
        </Txt>
        <Badge size="small" {...STATUS_STYLE[openness]}>
          {t(STATUS_LABEL[openness])}
        </Badge>
      </View>

      {place.subtitle ? (
        <Txt typography="t7" color={SdsColors.grey700}>
          {pickI18nText(place.subtitle, lang)}
        </Txt>
      ) : null}

      <Txt typography="t7" color={SdsColors.grey500}>
        {formatHours(place.hours, lang, t('eventmap.hours.always'))}
      </Txt>

      {compact
        ? null
        : place.fields.map((field, index) => (
            // Index in the key because the wire does not give a field an id, and
            // two rows may legitimately share a label.
            <View key={`${field.label.ko}-${index}`} style={styles.fieldRow}>
              <Txt typography="t7" fontWeight="bold" color={SdsColors.grey700}>
                {pickI18nText(field.label, lang)}
              </Txt>
              <Txt typography="t7" color={SdsColors.grey900} style={styles.fieldValue}>
                {pickI18nText(field.value, lang)}
              </Txt>
            </View>
          ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  fieldValue: { flexShrink: 1 },
});
