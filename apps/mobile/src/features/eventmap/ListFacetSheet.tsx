/**
 * The option picker a list filter chip opens.
 *
 * Two shapes, chosen by the facet's `select`:
 *
 *  - `optional` (일자, 운영): a checklist headed by 전체. It opens on 전체,
 *    which is "no filter". Tapping an option while 전체 is on picks that
 *    option alone, so narrowing to one day is one tap rather than unchecking
 *    every other. Unchecking the last option falls back to 전체, and checking
 *    every option collapses into 전체 — so "nothing selected" cannot exist and
 *    no tap is ever refused or needs a warning. The sheet stays up between
 *    taps.
 *  - `required`: one choice, marked with a check. Picking closes the sheet.
 *
 * A floating glass card sized to its rows, beside the campus sheet rather than
 * handed the screen — the filter sheet's posture, for the same reason: it is a
 * quick pick about the view behind it, not a destination.
 *
 * It decides nothing about the data: options and labels come from the
 * server's `MapChip.list`, and the selection from `CampusScreen`.
 */

import { forwardRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SdsColors, isWholeFacet, toggleChecklist, useT, type MapChipFacet } from '@skkuverse/shared';
import { Sheet, Txt, type SheetRef } from '@skkuverse/sds';

interface ListFacetSheetProps {
  /** The facet being picked, or `null` while no chip is open. */
  facet: MapChipFacet | null;
  /** The options currently held for it. Every option held is 전체. */
  held: readonly string[];
  onChange: (facetId: string, held: readonly string[]) => void;
  bottomGap: number;
}

export const ListFacetSheet = forwardRef<SheetRef, ListFacetSheetProps>(
  function ListFacetSheet({ facet, held, onChange, bottomGap }, ref) {
    const { t } = useT();
    const multi = facet?.select === 'optional';
    const whole = facet ? isWholeFacet(facet, held) : false;

    const rows: { id: string | null; label: string; active: boolean }[] = facet
      ? [
          ...(multi ? [{ id: null, label: t('common.total'), active: whole }] : []),
          ...facet.options.map((o) => ({
            id: o.id,
            label: o.label,
            // Under 전체 the options read unchecked: 전체 is the one choice made.
            active: held.includes(o.id) && !(multi && whole),
          })),
        ]
      : [];

    const press = (optionId: string | null) => {
      if (!facet) return;
      if (!multi) {
        if (optionId) onChange(facet.id, [optionId]);
        return;
      }
      onChange(facet.id, toggleChecklist(facet, held, optionId));
    };

    return (
      <Sheet
        ref={ref}
        position={{ kind: 'fit' }}
        surface="glass"
        backdrop
        bottomGap={bottomGap}
        stackBehavior="replace"
      >
        <Sheet.View style={styles.content}>
          {facet ? (
            <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
              {facet.label}
            </Txt>
          ) : null}
          {rows.map((row) => (
            <Pressable
              key={row.id ?? '*'}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={multi ? { checked: row.active } : { selected: row.active }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => press(row.id)}
            >
              <Txt
                typography="t5"
                fontWeight={row.active ? 'semiBold' : 'regular'}
                color={row.active ? SdsColors.grey900 : SdsColors.grey600}
              >
                {row.label}
              </Txt>
              {multi ? (
                <Ionicons
                  name={row.active ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={row.active ? SdsColors.brand : SdsColors.grey400}
                />
              ) : row.active ? (
                <Ionicons name="checkmark" size={20} color={SdsColors.brand} />
              ) : null}
            </Pressable>
          ))}
        </Sheet.View>
      </Sheet>
    );
  },
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowPressed: { opacity: 0.6 },
});
