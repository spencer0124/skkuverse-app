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

import React, { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { XIcon } from 'phosphor-react-native';
import { SdsColors, SdsRadius } from '@skkuverse/shared';
import { SHEET_GUTTER } from './layout';

const THUMB = 120;
const COMPACT_THUMB = 192;

export function PlaceGallery({ images, compact = false }: { images: readonly string[]; compact?: boolean }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const viewerRef = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();

  const closeViewer = useCallback(() => setSelectedIndex(null), []);
  const positionViewer = useCallback(() => {
    if (selectedIndex !== null) {
      viewerRef.current?.scrollTo({ x: selectedIndex * width, animated: false });
    }
  }, [selectedIndex, width]);
  const onViewerScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setSelectedIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  if (images.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        directionalLockEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
        {images.map((uri, index) => (
          <GalleryThumbnail
            key={uri}
            uri={uri}
            compact={compact}
            onOpen={() => setSelectedIndex(index)}
          />
        ))}
      </ScrollView>

      <Modal
        visible={selectedIndex !== null}
        animationType="fade"
        statusBarTranslucent
        onShow={positionViewer}
        onRequestClose={closeViewer}
      >
        <View style={styles.viewer}>
          <ScrollView
            ref={viewerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onViewerScrollEnd}
          >
            {images.map((uri) => (
              <View key={uri} style={[styles.viewerPage, { width, height }]}>
                <Image
                  source={{ uri }}
                  style={{ width, height }}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
            ))}
          </ScrollView>
          <Pressable
            style={styles.viewerClose}
            onPress={closeViewer}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
          >
            <XIcon size={26} color="#fff" weight="bold" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

/** A horizontal drag must never be mistaken for a tap that opens the viewer. */
function GalleryThumbnail({ uri, compact, onOpen }: { uri: string; compact: boolean; onOpen: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  return (
    <Pressable
      accessibilityRole="imagebutton"
      onTouchStart={(event) => {
        start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        moved.current = false;
      }}
      onTouchMove={(event) => {
        if (start.current === null) return;
        const dx = event.nativeEvent.pageX - start.current.x;
        const dy = event.nativeEvent.pageY - start.current.y;
        // This also leaves an upward sheet drag alone once it passes the tap
        // slop, even if the nested ScrollView has not claimed it yet.
        if (Math.hypot(dx, dy) > 8) moved.current = true;
      }}
      onPress={() => {
        if (!moved.current) onOpen();
      }}
    >
      <Image
        source={{ uri }}
        style={compact ? styles.compactThumb : styles.thumb}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    </Pressable>
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
  compactThumb: {
    width: 256,
    height: COMPACT_THUMB,
    borderRadius: SdsRadius.md,
    backgroundColor: SdsColors.grey100,
  },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerPage: { justifyContent: 'center', alignItems: 'center' },
  viewerClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
});
