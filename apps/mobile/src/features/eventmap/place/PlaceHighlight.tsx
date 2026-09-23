/**
 * The one block the collapsed sheet lifts above the fold.
 *
 * WHICH block is `highlightBlock`'s decision
 * (`packages/shared/src/map/placeDetail.ts`) — the first `list` or `table` in
 * the body, so the operator chooses it by ordering their blocks rather than by
 * a per-kind table written here. This file only draws it, in two shapes:
 *
 * - a `list` becomes a row of pills, which is what a booth's contents want;
 * - a `table` becomes a card — thumbnail, label, first row, and "외 N개".
 *
 * The card paints its own fill, because the collapsed sheet is glass and a
 * block without one is text over a moving map (`bottom-sheet-system.md`, "Each
 * block paints its own fill").
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  HIGHLIGHT_MAX,
  pickI18nText,
  SdsColors,
  SdsRadius,
  SdsSpacing,
  useSettingsStore,
  useT,
  type PlaceBlock,
  type PlaceListItem,
  type PlaceTableRow,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { SHEET_GUTTER } from './layout';

export function PlaceHighlight({ block }: { block: PlaceBlock }) {
  if (block.type === 'list') {
    return <ListPills items={block.items} />;
  }
  if (block.type === 'table') {
    return <TableCard title={block.title} rows={block.rows} />;
  }
  return null;
}

function ListPills({ items }: { items: readonly PlaceListItem[] }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const shown = items.slice(0, HIGHLIGHT_MAX.list);
  if (shown.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.pills, styles.pillBleed]}
      contentContainerStyle={styles.pillRow}
    >
      {shown.map((item, index) => (
        <View key={`${item.title.ko}-${index}`} style={styles.pill}>
          <Text style={styles.emoji}>{item.emoji ?? '✨'}</Text>
          <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey900} numberOfLines={1}>
            {pickI18nText(item.title, lang)}
          </Txt>
        </View>
      ))}
    </ScrollView>
  );
}

function TableCard({ title, rows }: { title: PlaceBlock['title']; rows: readonly PlaceTableRow[] }) {
  const { tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const first = rows[0];
  if (first === undefined) return null;

  const more = Math.max(0, rows.length - HIGHLIGHT_MAX.table);
  const value = pickI18nText(first.value, lang);
  const description = more > 0 ? `${value} · ${tpl('eventmap.menu.more', more)}` : value;

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        {title ? (
          <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey600}>
            {pickI18nText(title, lang)}
          </Txt>
        ) : null}
        <Txt typography="t6" fontWeight="semiBold" color={SdsColors.grey900} numberOfLines={1}>
          {pickI18nText(first.label, lang)}
        </Txt>
        <Txt typography="t7" color={SdsColors.grey600} numberOfLines={1}>
          {description}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: SdsSpacing.sm,
    minHeight: 72,
    padding: SdsSpacing.sm,
    borderRadius: SdsRadius.lg,
    backgroundColor: SdsColors.grey50,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: SdsRadius.md,
    backgroundColor: SdsColors.grey100,
  },
  copy: { flex: 1, justifyContent: 'center', gap: 1 },
  pillRow: { paddingHorizontal: SHEET_GUTTER, gap: SdsSpacing.sm },
  // A horizontal ScrollView otherwise expands into the summary's height,
  // separating the photo peek from the compact content pills.
  pills: { flexGrow: 0 },
  pillBleed: { marginHorizontal: -SHEET_GUTTER },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    maxWidth: 164,
    paddingHorizontal: SdsSpacing.sm,
    borderRadius: 18,
    backgroundColor: SdsColors.grey50,
  },
  emoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 14,
    lineHeight: 16,
  },
});
