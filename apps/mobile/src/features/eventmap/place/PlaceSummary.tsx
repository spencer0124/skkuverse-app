/**
 * The top of the place sheet — everything the collapsed card shows.
 *
 * One skeleton for every kind of place, top to bottom:
 *
 * ```text
 * eyebrow    주점 · 양일 · [연합]
 * title      슈퍼 정통 X 경영 브라더스      [운영중]
 * org        경영대학 · 정보통신대학 학생회
 * meta       18:00–00:00 · 주점존 A-1
 * actions    (입장 안내) (인스타그램)
 * highlight  대표 메뉴 / 대표 콘텐츠 / a line of text
 * gallery    ▢ ▢ ▢ ▢
 * ```
 *
 * The buttons come before the highlight, as Naver puts 출발 · 도착 under the
 * name: they are what a visitor acts on, so they must never be the row the
 * collapsed card's edge cuts through. The fold lands on the highlight or the
 * gallery instead, and a half-shown card or photo reads as "there is more".
 *
 * A row with nothing to say is not drawn, which is the whole difference between
 * a pub and a toilet: a toilet is the eyebrow, the title and the meta line.
 *
 * Without a detail the server's own summary fields stand in — `subtitle` in the
 * organisation's place and `fields` as label/value rows — so a place the mock
 * does not know renders exactly what the server says about it today.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  dayLabelOf,
  highlightOf,
  pickI18nText,
  SdsColors,
  SdsSpacing,
  useSettingsStore,
  useT,
  type MapOverlay,
  type PlaceDetail,
  type PlaceKind,
  type TranslationKey,
} from '@skkuverse/shared';
import { Badge, Txt } from '@skkuverse/sds';
import { PlaceActions } from './PlaceActions';
import { PlaceGallery } from './PlaceGallery';
import { PlaceHighlight } from './PlaceHighlight';
import { formatDays, formatHoursCompact, opennessOf, STATUS_LABEL, STATUS_STYLE } from './placeFormat';

const KIND_LABEL: Record<PlaceKind, TranslationKey> = {
  pub: 'eventmap.kind.pub',
  booth: 'eventmap.kind.booth',
  promo: 'eventmap.kind.promo',
  foodTruck: 'eventmap.kind.foodTruck',
  goods: 'eventmap.kind.goods',
  facility: 'eventmap.kind.facility',
  stage: 'eventmap.kind.stage',
  etc: 'eventmap.kind.etc',
};

interface PlaceSummaryProps {
  place: MapOverlay;
  detail: PlaceDetail | null;
  /** The pin's layer label, for a place with no detail to name its kind. */
  categoryLabel: string | null;
  festivalDays: readonly string[];
  now: number;
  /** The fold: how tall the collapsed card's content area is. See `sheetFold.ts`. */
  minHeight: number;
  onNavigateAway?: () => void;
}

export function PlaceSummary({
  place,
  detail,
  categoryLabel,
  festivalDays,
  now,
  minHeight,
  onNavigateAway,
}: PlaceSummaryProps) {
  const { t, tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);

  const kindLabel = detail ? t(KIND_LABEL[detail.kind]) : categoryLabel;
  const days = dayLabelOf(place.hours, festivalDays);
  const eyebrow = [kindLabel, days ? formatDays(days, t, tpl) : null].filter(Boolean).join(' · ');

  const openness = opennessOf(place.hours, now);
  // An always-open place says so on the meta line; a 운영중 pill beside a
  // toilet's name would only repeat it.
  const showStatus = place.hours.length > 0;

  const orgText = detail
    ? detail.org && pickI18nText(detail.org, lang)
    : place.subtitle && pickI18nText(place.subtitle, lang);
  const meta = [
    formatHoursCompact(place.hours, lang, t('eventmap.hours.always')),
    detail?.locationLabel ? pickI18nText(detail.locationLabel, lang) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const highlight = highlightOf(detail);
  const fields = detail ? [] : place.fields;

  return (
    <View style={[styles.summary, { minHeight }]}>
      <View style={styles.heading}>
        {eyebrow || detail?.isUnion ? (
          <View style={styles.eyebrow}>
            {eyebrow ? (
              <Txt typography="t7" fontWeight="medium" color={SdsColors.grey600}>
                {eyebrow}
              </Txt>
            ) : null}
            {detail?.isUnion ? (
              <Badge size="tiny" color={SdsColors.brand} backgroundColor={SdsColors.brandLight}>
                {t('eventmap.union')}
              </Badge>
            ) : null}
          </View>
        ) : null}

        <View style={styles.titleRow}>
          <Txt typography="t3" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
            {pickI18nText(place.text, lang)}
          </Txt>
          {showStatus ? (
            <Badge size="small" {...STATUS_STYLE[openness]}>
              {t(STATUS_LABEL[openness])}
            </Badge>
          ) : null}
        </View>

        {orgText ? (
          <Txt typography="t6" color={SdsColors.grey700}>
            {orgText}
          </Txt>
        ) : null}

        <Txt typography="t7" color={SdsColors.grey500}>
          {meta}
        </Txt>

        {fields.map((field, index) => (
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

      <PlaceActions
        actions={place.actions}
        instagramUrl={detail?.instagramUrl ?? null}
        onNavigateAway={onNavigateAway}
      />

      {highlight ? <PlaceHighlight highlight={highlight} /> : null}

      <PlaceGallery images={detail?.images ?? []} />
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: SdsSpacing.md, paddingBottom: SdsSpacing.lg },
  heading: { gap: 3 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: SdsSpacing.xs + 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SdsSpacing.sm },
  title: { flexShrink: 1 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  fieldValue: { flexShrink: 1 },
});
