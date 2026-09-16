/**
 * A sideways strip of a place's photos, the last block of the summary.
 *
 * Last on purpose: it is what the collapsed card's bottom edge cuts through,
 * the way Naver's photo row peeks under its buttons — a half-visible image says
 * "there is more if you pull" without a word of copy.
 *
 * A plain React Native `ScrollView`, not one of gorhom's: a gorhom scrollable
 * cannot nest inside another (`Sheet.tsx`), and a horizontal one would not help
 * the sheet's own vertical drag anyway.
 */

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SdsColors, SdsRadius } from '@skkuverse/shared';
import { SHEET_GUTTER } from './layout';

const THUMB = 120;

export function PlaceGallery({ images }: { images: readonly string[] }) {
  if (images.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.row}
    >
      {images.map((uri) => (
        <Image
          key={uri}
          source={{ uri }}
          style={styles.thumb}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -SHEET_GUTTER, flexGrow: 0 },
  row: { paddingHorizontal: SHEET_GUTTER, gap: 6 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: SdsRadius.md,
    backgroundColor: SdsColors.grey100,
  },
});
