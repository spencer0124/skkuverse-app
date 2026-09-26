/**
 * The top of the place sheet — everything the collapsed card shows.
 *
 * One skeleton for every kind of place, top to bottom:
 *
 * ```text
 * status     운영 중 · 10/1(목) 22:00 종료
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
 * A lone Instagram is not drawn here at all: it sits beside the title in the
 * sheet's header (`EventMapPeekSheet`, `soleInstagram`), so the actions row is
 * skipped rather than drawn empty.
 *
 * The operator's `org` leads the metadata line when the detail names one, and
 * the server's `subtitle` stands in otherwise — a food truck names no operator,
 * and its subtitle (야끼소바 · 오꼬노미야끼) is the line worth reading.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  heroGallery,
  highlightBlock,
  pickI18nText,
  placeBody,
  SdsColors,
  soleInstagram,
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
import { statusLineOf } from './placeFormat';

interface PlaceSummaryProps {
  place: MapOverlay;
  detail: PlaceDetail | null;
  now: number;
  onNavigateAway?: () => void;
}

export function PlaceSummary({
  place,
  detail,
  now,
  onNavigateAway,
}: PlaceSummaryProps) {
  const { t, tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);

  const orgSource = detail?.org ?? place.subtitle;
  const orgText = orgSource ? pickI18nText(orgSource, lang) : null;
  const meta = [
    detail?.locationLabel ? pickI18nText(detail.locationLabel, lang) : null,
    orgText,
  ]
    .filter(Boolean)
    .join(' · ');

  const blocks = detail?.blocks ?? [];
  const highlight = highlightBlock(blocks);
  // The summary owns the body's first photo rail; `PlaceBlocks` skips it by id
  // so it is not drawn twice in one sheet.
  const hero = heroGallery(placeBody(blocks));
  const status = statusLineOf(place.hours, now, t, tpl);
  const inlineInstagram = soleInstagram(place.actions, detail?.actions ?? []);

  return (
    <View style={styles.summary}>
      <View style={styles.heading}>
        <Txt typography="t7" color={SdsColors.grey600}>
          {status.text}
        </Txt>
        {meta ? (
          // Two lines, not one: an operator is often a joint council
          // ("의과대학 제28대 학생회 Smile X 약학대학 …") and one line cut the
          // name off mid-word.
          <Txt typography="t7" color={SdsColors.grey600} numberOfLines={2}>
            {meta}
          </Txt>
        ) : null}
      </View>

      {inlineInstagram ? null : (
        <PlaceActionsRow
          actions={place.actions}
          detailActions={detail?.actions ?? []}
          onNavigateAway={onNavigateAway}
        />
      )}

      {highlight ? <PlaceHighlight block={highlight} /> : null}

      {/* Under the highlight, so the collapsed card's edge cuts a photo rather
          than a row the visitor acts on. A half-shown image reads as "there is
          more" without a word of copy. */}
      {hero ? <PlaceGallery images={hero.images} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: SdsSpacing.md, paddingBottom: SdsSpacing.lg },
  heading: { gap: 3 },
});
