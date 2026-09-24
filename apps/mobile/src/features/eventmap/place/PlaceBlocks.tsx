/**
 * A place's body, drawn one block at a time.
 *
 * The operator composes the body out of five typed blocks and orders them; this
 * file decides only how each type looks. Nothing here branches on the place's
 * kind — a pub and a goods shop differ by which blocks they carry, not by a
 * rule written here.
 *
 * **An unknown `type` renders nothing and the rest of the body survives.** The
 * switch deliberately has no exhaustive `never` arm: `PlaceBlock['type']` is an
 * open enum, and an assertion would blank a whole body on an older build the
 * day the server ships a sixth type. Same discipline as `OVERLAY_KINDS` on the
 * overlay wire.
 *
 * Every renderer here was lifted out of `PlaceSections.tsx` unchanged, so the
 * booth layout the design was built around looks exactly as it did.
 */

import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import {
  heroGallery,
  pickI18nText,
  placeBody,
  SdsColors,
  SdsRadius,
  SdsSpacing,
  useSettingsStore,
  useT,
  type I18nText,
  type PlaceBlock,
  type PlaceListItem,
  type PlaceTableRow,
} from '@skkuverse/shared';
import { Border, ListRow, TextButton, Txt } from '@skkuverse/sds';
import { PlaceGallery } from './PlaceGallery';

/** How many lines of a text block show before 더보기. */
const TEXT_LINES = 3;

export function PlaceBlocks({ blocks }: { blocks: readonly PlaceBlock[] }) {
  // Consecutive images fold into one rail (`placeBody`). The summary draws the
  // first rail under the highlight, so the body skips it; any later rail is the
  // operator's own, and stays where they put it.
  const body = placeBody(blocks);
  const heroId = heroGallery(body)?.id;
  return (
    <View style={styles.body}>
      {body
        .filter((item) => item.id !== heroId)
        .map((item) =>
          item.type === 'gallery' ? (
            <PlaceGallery key={item.id} images={item.images} />
          ) : (
            <PlaceBlockView key={item.id} block={item.block} />
          ),
        )}
    </View>
  );
}

function PlaceBlockView({ block }: { block: PlaceBlock }) {
  switch (block.type) {
    case 'text':
      return <TextBlock title={block.title} body={block.body} />;
    case 'list':
      return <ListBlock title={block.title} items={block.items} />;
    case 'table':
      return <TableBlock title={block.title} rows={block.rows} />;
    // Folded into a gallery by `placeBody` before this switch is reached.
    case 'image':
      return null;
    case 'notice':
      return <NoticeBlock title={block.title} items={block.items} />;
    // No `never` arm, on purpose. See the file header.
    default:
      return null;
  }
}

function BlockTitle({ title }: { title: I18nText | null }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  if (title === null) return null;
  return (
    <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey600} style={styles.blockTitle}>
      {pickI18nText(title, lang)}
    </Txt>
  );
}

// ── text ──────────────────────────────────────────────────────────────────

function TextBlock({ title, body }: { title: I18nText | null; body: I18nText }) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const text = pickI18nText(body, lang);

  // Measured on an unclamped copy, because a clamped `Text` reports only the
  // lines it drew and could never say it was cut.
  const onMeasure = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setOverflows(e.nativeEvent.lines.length > TEXT_LINES);
  }, []);

  return (
    <View>
      <BlockTitle title={title} />
      <View style={styles.quote}>
        {/* Both copies share this box, so the unclamped one wraps at exactly the
            width the clamped one does. Measuring against a wider box reports
            fewer lines and silently hides 더보기. */}
        <View style={styles.quoteText}>
          <Txt typography="t6" color={SdsColors.grey800} onTextLayout={onMeasure} style={styles.measure}>
            {text}
          </Txt>
          <Txt typography="t6" color={SdsColors.grey800} numberOfLines={expanded ? undefined : TEXT_LINES}>
            {text}
          </Txt>
          {overflows ? (
            <TextButton
              typography="t7"
              fontWeight="semiBold"
              color={SdsColors.grey600}
              onPress={() => setExpanded((v) => !v)}
              style={styles.moreButton}
            >
              {t(expanded ? 'eventmap.less' : 'eventmap.more')}
            </TextButton>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ── list ──────────────────────────────────────────────────────────────────

function ListBlock({ title, items }: { title: I18nText | null; items: readonly PlaceListItem[] }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  return (
    <View>
      <BlockTitle title={title} />
      {items.map((item, i) => (
        <ListRow
          key={`${item.title.ko}-${i}`}
          horizontalPadding={0}
          verticalPadding="extraSmall"
          // A name alone sits on the emoji's centre line. With a description
          // under it, the emoji stays level with the name instead of drifting
          // down between the two lines.
          leftAlignment={item.description ? 'top' : 'center'}
          left={
            <View style={styles.emoji}>
              <Text style={styles.emojiText}>{item.emoji ?? '✨'}</Text>
            </View>
          }
          contents={
            item.description ? (
              <ListRow.Texts
                type="2RowTypeA"
                top={pickI18nText(item.title, lang)}
                topProps={{ typography: 't6', fontWeight: 'semiBold' }}
                bottom={pickI18nText(item.description, lang)}
                bottomProps={{ typography: 't7' }}
              />
            ) : (
              <ListRow.Texts
                type="1RowTypeA"
                top={pickI18nText(item.title, lang)}
                topProps={{ typography: 't6', fontWeight: 'semiBold' }}
              />
            )
          }
        />
      ))}
    </View>
  );
}

// ── table ─────────────────────────────────────────────────────────────────

function TableBlock({ title, rows }: { title: I18nText | null; rows: readonly PlaceTableRow[] }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  return (
    <View>
      <BlockTitle title={title} />
      {rows.map((r, i) => (
        <React.Fragment key={`${r.label.ko}-${i}`}>
          {i > 0 ? <Border type="full" /> : null}
          <ListRow
            horizontalPadding={0}
            // Between ListRow's 8 and 16: a price list is scanned, and 16 spread
            // a seven-line menu over most of the sheet.
            containerStyle={styles.tableRow}
            contents={
              <ListRow.Texts
                type="1RowTypeC"
                top={pickI18nText(r.label, lang)}
                topProps={{ color: SdsColors.grey900 }}
              />
            }
            right={
              <Txt typography="t6" fontWeight="semiBold" color={SdsColors.grey900}>
                {pickI18nText(r.value, lang)}
              </Txt>
            }
          />
        </React.Fragment>
      ))}
    </View>
  );
}

// ── notice ────────────────────────────────────────────────────────────────

function NoticeBlock({ title, items }: { title: I18nText | null; items: readonly I18nText[] }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  return (
    <View>
      <BlockTitle title={title} />
      <View style={styles.bullets}>
        {items.map((item, i) => (
          <View key={`${item.ko}-${i}`} style={styles.bulletRow}>
            <Txt typography="t6" color={SdsColors.grey500} style={styles.bulletMark}>
              •
            </Txt>
            <Txt typography="t6" color={SdsColors.grey800} style={styles.bulletText}>
              {pickI18nText(item, lang)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: SdsSpacing.xl },
  blockTitle: { marginBottom: SdsSpacing.xs },
  quote: { flexDirection: 'row', borderLeftWidth: 3, borderLeftColor: SdsColors.grey300, paddingLeft: SdsSpacing.base },
  quoteText: { flex: 1 },
  // Laid out for its line count only; never seen, never hit-tested.
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  moreButton: { marginTop: SdsSpacing.xs },
  emoji: {
    width: 36,
    height: 36,
    borderRadius: SdsRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SdsColors.brandLight,
  },
  emojiText: { fontFamily: 'TossFaceFontMac', fontSize: 18, lineHeight: 22 },
  tableRow: { paddingVertical: SdsSpacing.md },
  bullets: { gap: SdsSpacing.sm },
  bulletRow: { flexDirection: 'row', gap: SdsSpacing.sm },
  bulletMark: { paddingTop: 1 },
  bulletText: { flex: 1 },
});
