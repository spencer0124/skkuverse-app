/**
 * The top of the place sheet — everything the collapsed card shows.
 *
 * One skeleton for every kind of place, top to bottom:
 *
 * ```text
 * status     운영 중 · 22:00 종료
 * meta       주점존 A-1 · 경영대학 학생회
 * preview    대표 콘텐츠
 * photos     ▬ ▬ ▬ (the lower edge clips this rail)
 * ```
 *
 * The fold lands on the highlight or gallery, so a half-shown card or photo
 * reads as "there is more". Actions and the full introduction live in Home,
 * keeping the compact card scannable.
 *
 * A row with nothing to say is not drawn, which is the whole difference between
 * a pub and a toilet: a toilet is only its live status.
 *
 * Without a detail the server's `subtitle` stands in for the metadata line, so
 * an unmocked place still renders a useful, compact card.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  dayLabelOf,
  firstImageUrl,
  highlightBlock,
  pickI18nText,
  SdsColors,
  SdsSpacing,
  useSettingsStore,
  useT,
  type MapOverlay,
  type PlaceDetail,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { PlaceActionsRow } from './PlaceActionsRow';
import { PlaceGallery } from './PlaceGallery';
import { PlaceHighlight } from './PlaceHighlight';
import { formatDays, statusLineOf } from './placeFormat';

interface PlaceSummaryProps {
  place: MapOverlay;
  detail: PlaceDetail | null;
  now: number;
  /**
   * Every KST day the served places open on, from `festivalDaysOf`. What a
   * place's 1일차/2일차 is counted against; an empty or one-day list means
   * there is nothing worth saying and the status line stands alone.
   */
  festivalDays: readonly string[];
  onNavigateAway?: () => void;
}

export function PlaceSummary({
  place,
  detail,
  now,
  festivalDays,
  onNavigateAway,
}: PlaceSummaryProps) {
  const { t, tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);

  const orgText = detail
    ? detail.org && pickI18nText(detail.org, lang)
    : place.subtitle && pickI18nText(place.subtitle, lang);
  const meta = [
    detail?.locationLabel ? pickI18nText(detail.locationLabel, lang) : null,
    orgText,
  ]
    .filter(Boolean)
    .join(' · ');

  const blocks = detail?.blocks ?? [];
  const highlight = highlightBlock(blocks);
  // The summary owns the first image; `PlaceBlocks` skips it so it is not drawn
  // twice in one sheet.
  const heroUrl = firstImageUrl(blocks);
  const status = statusLineOf(place.hours, now, lang, t, tpl);
  // Which festival day, appended to the status rather than given a row of its
  // own: nine places run on one day only — the eight night bars and the
  // t-shirt hand-out — and for them "종료" alone is missing the half of the
  // answer that says whether to come back tomorrow.
  const days = dayLabelOf(place.hours, festivalDays);
  const statusText = days === null ? status.text : `${status.text} · ${formatDays(days, t, tpl)}`;

  return (
    <View style={styles.summary}>
      <View style={styles.heading}>
        <Txt typography="t7" color={SdsColors.grey600}>
          {statusText}
        </Txt>
        {meta ? (
          <Txt typography="t7" color={SdsColors.grey600} numberOfLines={1}>
            {meta}
          </Txt>
        ) : null}
      </View>

      <PlaceActionsRow
        actions={place.actions}
        detailActions={detail?.actions ?? []}
        onNavigateAway={onNavigateAway}
      />

      {highlight ? <PlaceHighlight block={highlight} /> : null}

      {/* Under the highlight, so the collapsed card's edge cuts a photo rather
          than a row the visitor acts on. A half-shown image reads as "there is
          more" without a word of copy. */}
      {heroUrl ? <PlaceGallery images={[heroUrl]} compact /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: SdsSpacing.md, paddingBottom: SdsSpacing.lg },
  heading: { gap: 3 },
});
