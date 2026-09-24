/**
 * A place, drawn as a list row.
 *
 * The event list is the one caller left: the peek sheet grew its own summary
 * (`place/PlaceSummary.tsx`), and both read status and hours from
 * `place/placeFormat.ts` so the row and the sheet cannot disagree.
 *
 * **A fixed layout, deliberately.** This replaced `CardRenderer`, which drew
 * whatever slots a server-declared `cardTemplateId` resolved to. The template
 * tier is gone from the wire — the marker carries `subtitle`, `hours`, `fields`
 * and `actions` directly, in authored order — so the only thing the templates
 * were still buying was the ability to reorder four rows from the server, at
 * the cost of a slot union, a resolver and a publish pipeline to keep them in
 * step. `fields` preserves the one ordering that was ever ops-driven.
 *
 * `now` is a prop rather than a `Date.now()` call in the body, because the card
 * must re-derive when the clock crosses a boundary and nothing else changes —
 * `useWindowClock` upstream owns that timer. Reading the clock here would make
 * the pill correct only until the next render for any other reason.
 */

import { StyleSheet, View } from 'react-native';
import {
  pickI18nText,
  SdsColors,
  useSettingsStore,
  useT,
  type MapOverlay,
} from '@skkuverse/shared';
import { Badge, Txt } from '@skkuverse/sds';
import { formatHours, opennessOf, STATUS_LABEL, STATUS_STYLE } from './place/placeFormat';

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
        {formatHours(place.hours, t, t('eventmap.hours.always'))}
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
