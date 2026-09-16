/**
 * The collapsed sheet's one extra block — what a place serves or runs.
 *
 * Which block, and how many lines, is `highlightOf`'s decision
 * (`packages/shared/src/map/placeDetail.ts`); this file only draws it. The card
 * paints its own fill, because the collapsed sheet is glass and a block without
 * one is text over a moving map (`bottom-sheet-system.md`, "Each block paints
 * its own fill").
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  formatPriceRange,
  groupThousands,
  pickI18nText,
  SdsColors,
  SdsRadius,
  SdsSpacing,
  useSettingsStore,
  useT,
  type PlaceHighlight as Highlight,
  type PlaceMenuItem,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

export function PlaceHighlight({ highlight }: { highlight: Highlight }) {
  const { t, tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);

  if (highlight.type === 'text') {
    return (
      <View style={styles.card}>
        <Txt typography="t6" color={SdsColors.grey800} numberOfLines={2}>
          {pickI18nText(highlight.text, lang)}
        </Txt>
      </View>
    );
  }

  if (highlight.type === 'contents') {
    return (
      <View style={styles.card}>
        <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey600}>
          {t('eventmap.section.contents')}
        </Txt>
        {highlight.items.map((content, i) => (
          <View key={`${content.title.ko}-${i}`} style={styles.contentRow}>
            <Txt typography="t6" fontWeight="semiBold" color={SdsColors.grey900} numberOfLines={1}>
              {pickI18nText(content.title, lang)}
            </Txt>
            {content.description ? (
              <Txt typography="t7" color={SdsColors.grey600} numberOfLines={1}>
                {pickI18nText(content.description, lang)}
              </Txt>
            ) : null}
          </View>
        ))}
        {highlight.more > 0 ? <More text={tpl('eventmap.menu.more', highlight.more)} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* The entry fee rides on the label's line: it is one number, and a row
          of its own would push a menu line under the collapsed card's edge. */}
      <View style={styles.headerRow}>
        <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey600}>
          {t('eventmap.highlight.menu')}
        </Txt>
        {highlight.entryFee ? (
          <Txt typography="t7" color={SdsColors.grey600}>
            {`${t('eventmap.section.entryFee')} ${tpl('eventmap.price', formatPriceRange(highlight.entryFee))}`}
          </Txt>
        ) : null}
      </View>
      {highlight.items.map((item, i) => (
        <MenuLine key={`${item.name.ko}-${i}`} item={item} />
      ))}
      {highlight.more > 0 ? <More text={tpl('eventmap.menu.more', highlight.more)} /> : null}
    </View>
  );
}

function MenuLine({ item }: { item: PlaceMenuItem }) {
  const { tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const price =
    item.price !== null
      ? tpl('eventmap.price', groupThousands(item.price))
      : item.note
        ? pickI18nText(item.note, lang)
        : null;
  return <Line name={pickI18nText(item.name, lang)} price={price} />;
}

function Line({ name, price }: { name: string; price: string | null }) {
  return (
    <View style={styles.line}>
      <Txt typography="t6" color={SdsColors.grey900} numberOfLines={1} style={styles.lineName}>
        {name}
      </Txt>
      {price !== null ? (
        <Txt typography="t6" fontWeight="semiBold" color={SdsColors.grey900}>
          {price}
        </Txt>
      ) : null}
    </View>
  );
}

function More({ text }: { text: string }) {
  return (
    <Txt typography="t7" color={SdsColors.grey500}>
      {text}
    </Txt>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SdsSpacing.xs,
    paddingHorizontal: SdsSpacing.base,
    paddingVertical: SdsSpacing.md,
    borderRadius: SdsRadius.lg,
    backgroundColor: SdsColors.grey50,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SdsSpacing.sm },
  contentRow: { gap: 1, marginTop: 2 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: SdsSpacing.md },
  lineName: { flex: 1 },
});
