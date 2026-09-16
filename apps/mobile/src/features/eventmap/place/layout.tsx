/**
 * The place sheet's shared measurements and the two structural blocks every
 * section uses.
 *
 * The sheet's scroll content carries the column's only horizontal padding
 * (`docs/explanation/bottom-sheet-system.md`, "The sheet's content wrapper
 * carries the only horizontal padding"), so a block that must reach the card's
 * edge — a divider, the tab bar, a sideways scroller — bleeds out by exactly
 * that gutter rather than inventing its own.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SdsColors, SdsSpacing } from '@skkuverse/shared';
import { ListHeader } from '@skkuverse/sds';

/** The scroll content's horizontal padding, which `EventMapPeekSheet` applies. */
export const SHEET_GUTTER = SdsSpacing.lg;

/** The 8pt grey band between sections, run to the card's edges. */
export function SectionDivider() {
  return <View style={styles.divider} />;
}

/** A section title. `ListHeader`'s own 24pt inset is dropped for the sheet's gutter. */
export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <ListHeader
      style={styles.header}
      title={
        <ListHeader.TitleParagraph typography="t5" fontWeight="bold" color={SdsColors.grey900}>
          {children}
        </ListHeader.TitleParagraph>
      }
      right={right}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: SdsSpacing.sm,
    marginHorizontal: -SHEET_GUTTER,
    backgroundColor: SdsColors.grey50,
  },
  header: { paddingHorizontal: 0 },
});
