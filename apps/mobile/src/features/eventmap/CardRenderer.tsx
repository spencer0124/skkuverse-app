/**
 * Renders a card from its resolved template slots.
 *
 * Slots are drawn in the order the template declares them — array order is
 * meaningful on the wire and the server preserves it deliberately. That is why
 * there is no "if slot 0 is a thumbnail and slot 1 a title, lay them out as a
 * row" rule: a special case keyed on positions holds for exactly the three
 * templates ESKARA ships today and silently mis-renders the fourth.
 *
 * The status pill rides with the `title` slot rather than being a slot of its
 * own. It is not template-driven — every card wants it, the server never
 * declares it — and detaching it from the title would leave the title row
 * looking unfinished on a template that puts `subtitle` between them.
 *
 * Slot resolution itself is `resolveSlots` in packages/shared: pure, and unit
 * tested where apps/mobile's `node --test` runner cannot reach a `.tsx`.
 */

import { Image, StyleSheet, View } from 'react-native';
import {
  SdsColors,
  useT,
  type ItemStatus,
  type ResolvedSlot,
  type TranslationKey,
} from '@skkuverse/shared';
import { Badge, Txt } from '@skkuverse/sds';

const STATUS_LABEL: Record<ItemStatus, TranslationKey> = {
  open: 'eventmap.status.open',
  upcoming: 'eventmap.status.upcoming',
  closed: 'eventmap.status.closed',
  unknown: 'eventmap.status.unknown',
};

const STATUS_STYLE: Record<ItemStatus, { color: string; backgroundColor: string }> = {
  open: { color: SdsColors.brand, backgroundColor: SdsColors.grey100 },
  upcoming: { color: SdsColors.grey700, backgroundColor: SdsColors.grey100 },
  closed: { color: SdsColors.grey500, backgroundColor: SdsColors.grey100 },
  unknown: { color: SdsColors.grey500, backgroundColor: SdsColors.grey100 },
};

interface CardRendererProps {
  slots: readonly ResolvedSlot[];
  status: ItemStatus;
  /** `compact` drops the thumbnail and tags — the list needs scannable rows. */
  variant?: 'full' | 'compact';
}

export function CardRenderer({ slots, status, variant = 'full' }: CardRendererProps) {
  const { t } = useT();
  const compact = variant === 'compact';

  return (
    <View style={styles.card}>
      {slots.map((slot, index) => {
        // Slot kinds are unique per template in practice but the contract does
        // not forbid a repeat, so the index keeps keys stable either way.
        const key = `${slot.kind}-${index}`;
        switch (slot.kind) {
          case 'thumbnail':
            if (compact) return null;
            return <Image key={key} source={{ uri: slot.uri }} style={styles.thumbnail} />;
          case 'title':
            return (
              <View key={key} style={styles.titleRow}>
                <Txt typography={compact ? 't6' : 't5'} fontWeight="bold" style={styles.title}>
                  {slot.value}
                </Txt>
                <Badge size="small" {...STATUS_STYLE[status]}>
                  {t(STATUS_LABEL[status])}
                </Badge>
              </View>
            );
          case 'subtitle':
            return (
              <Txt key={key} typography="t7" color={SdsColors.grey700}>
                {slot.value}
              </Txt>
            );
          case 'hours':
            return (
              <Txt key={key} typography="t7" color={SdsColors.grey500}>
                {slot.value}
              </Txt>
            );
          case 'field':
            return (
              <View key={key} style={styles.fieldRow}>
                <Txt typography="t7" fontWeight="bold" color={SdsColors.grey700}>
                  {slot.label}
                </Txt>
                <Txt typography="t7" color={SdsColors.grey900} style={styles.fieldValue}>
                  {slot.value}
                </Txt>
              </View>
            );
          case 'tags':
            if (compact) return null;
            return (
              <View key={key} style={styles.tagRow}>
                {slot.values.map((tag) => (
                  <Badge
                    key={tag}
                    size="tiny"
                    color={SdsColors.grey600}
                    backgroundColor={SdsColors.grey100}
                  >
                    {tag}
                  </Badge>
                ))}
              </View>
            );
          default:
            // Unreachable: ResolvedSlot is closed and resolveSlots drops the rest.
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  thumbnail: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: SdsColors.grey100,
    marginBottom: 4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  fieldValue: { flexShrink: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
});
