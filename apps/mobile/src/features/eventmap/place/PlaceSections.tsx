/**
 * The title-free blocks below the place sheet's summary.
 *
 * Which of these a place gets, and under which tab, is `buildPlaceTabs`'
 * decision (`packages/shared/src/map/placeDetail.ts`). Each block here assumes
 * it has something to draw — an empty one is never mounted — and each is built
 * from SDS list primitives with `ListRow`'s own inset turned off, since the
 * sheet's scroll content already carries the gutter.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CaretDownIcon, CaretUpIcon, ClockIcon, MapPinIcon } from 'phosphor-react-native';
import {
  pickI18nText,
  SdsColors,
  SdsRadius,
  SdsSpacing,
  useSettingsStore,
  useT,
  type MapOverlay,
  type PlaceDetail,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { formatHoursCompact, formatHoursLines } from './placeFormat';

const ICON_SIZE = 19;
const ICON_COLOR = SdsColors.grey500;

// ── 기본 정보와 링크 ───────────────────────────────────────────────────────

/**
 * A Naver-style fact list. Static facts, Instagram, and ordinary links share
 * the same visual grammar; only the destination behavior differs.
 */
export function FactsSection({ place, detail }: { place: MapOverlay; detail: PlaceDetail | null }) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  // `locationLabel` alone, never `place.subtitle`. The wire's subtitle is
  // whatever ops wrote — a bay number, a kind and a day, an operating note, a
  // shuttle route — so half of the 18 bars would read "location: 연합 주점".
  // It already shows once, in the summary's meta line, which is where a
  // subtitle belongs; the location row waits for a real location.
  const location = detail?.locationLabel ? pickI18nText(detail.locationLabel, lang) : null;

  return (
    <View style={styles.facts}>
      {location ? (
        <FactRow
          icon={<MapPinIcon size={ICON_SIZE} color={ICON_COLOR} />}
          label={t('eventmap.info.location')}
          text={location}
        />
      ) : null}
      <HoursFactRow hours={place.hours} />
    </View>
  );
}

function HoursFactRow({ hours }: { hours: MapOverlay['hours'] }) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const [expanded, setExpanded] = useState(false);
  const expandable = hours.length > 1;
  const text = expanded
    ? formatHoursLines(hours, lang).join('\n')
    : formatHoursCompact(hours, lang, t('eventmap.hours.always'));

  return (
    <FactRow
      icon={<ClockIcon size={ICON_SIZE} color={ICON_COLOR} />}
      label={t('eventmap.info.hours')}
      text={text}
      onPress={expandable ? () => setExpanded((value) => !value) : undefined}
      accessory={
        expandable ? expanded ? (
          <CaretUpIcon size={18} color={SdsColors.grey500} />
        ) : (
          <CaretDownIcon size={18} color={SdsColors.grey500} />
        ) : null
      }
    />
  );
}

function FactRow({
  icon,
  label,
  text,
  link = false,
  onPress,
  accessory,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  link?: boolean;
  onPress?: () => void;
  accessory?: React.ReactNode;
}) {
  const content = (
    <View style={styles.factRow}>
      <View style={styles.factLabel}>
        <View style={styles.factIcon}>{icon}</View>
        <Txt typography="t7" color={SdsColors.grey500} numberOfLines={1}>
          {label}
        </Txt>
      </View>
      <View style={styles.factValue}>
        <Txt typography="t7" color={link ? SdsColors.blue600 : SdsColors.grey800} style={styles.factText}>
          {text}
        </Txt>
        {accessory ? <View style={styles.factAccessory}>{accessory}</View> : null}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole={link ? 'link' : 'button'} onPress={onPress} style={styles.factButton}>
      {content}
    </Pressable>
  ) : content;
}

const styles = StyleSheet.create({
  facts: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SdsColors.grey200,
    borderRadius: SdsRadius.lg,
    backgroundColor: SdsColors.background,
  },
  factButton: { alignSelf: 'stretch' },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SdsSpacing.base,
    paddingVertical: SdsSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SdsColors.grey100,
  },
  factLabel: {
    width: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.xs,
    paddingTop: 1,
    paddingRight: SdsSpacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: SdsColors.grey100,
  },
  factIcon: { width: 20, alignItems: 'center' },
  factValue: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', paddingLeft: SdsSpacing.base },
  factText: { flex: 1 },
  factAccessory: { marginLeft: SdsSpacing.sm, paddingTop: 2 },
  noticeStack: { flex: 1, gap: SdsSpacing.sm, paddingLeft: SdsSpacing.base },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SdsSpacing.sm },
  noticeBullet: { paddingTop: 1 },
  introQuote: { borderLeftWidth: 3, borderLeftColor: SdsColors.grey300, paddingLeft: SdsSpacing.base },
  introRow: { flexDirection: 'row', gap: SdsSpacing.md },
  logo: {
    width: 56,
    height: 56,
    borderRadius: SdsRadius.md,
    backgroundColor: SdsColors.grey100,
  },
  introText: { flex: 1 },
  // Laid out for its line count only; never seen, never hit-tested.
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  moreButton: { marginTop: SdsSpacing.xs },
  bullets: { gap: SdsSpacing.sm },
  bulletRow: { flexDirection: 'row', gap: SdsSpacing.sm },
  bulletText: { flex: 1 },
  priceRow: { paddingVertical: SdsSpacing.md },
  menuGroupTitle: { marginTop: SdsSpacing.lg, marginBottom: SdsSpacing.xs },
  disclaimer: { marginTop: SdsSpacing.base },
  contentEmoji: {
    width: 36,
    height: 36,
    borderRadius: SdsRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SdsColors.brandLight,
  },
  contentEmojiText: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 18,
    lineHeight: 22,
  },
});
