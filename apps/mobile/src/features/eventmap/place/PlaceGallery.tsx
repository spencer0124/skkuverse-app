/**
 * A sideways strip of a place's photos, each with its caption under it.
 *
 * One rail per run of consecutive image blocks (`placeBody`), so a food truck's
 * three dish photos are one strip the viewer pages across rather than three
 * strips of one. The summary draws the body's first rail as its last block.
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
import {
  pickI18nText,
  SdsColors,
  SdsRadius,
  SdsSpacing,
  useSettingsStore,
  type PlaceImage,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { SHEET_GUTTER } from './layout';

const THUMB_WIDTH = 256;
const THUMB_HEIGHT = 192;

export function PlaceGallery({ images }: { images: readonly PlaceImage[] }) {
  const lang = useSettingsStore((s) => s.appLanguage);
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
        {images.map((image, index) => (
          <GalleryThumbnail
            key={image.id}
            uri={image.url}
            caption={image.caption ? pickI18nText(image.caption, lang) : null}
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
            {images.map((image) => (
              <View key={image.id} style={[styles.viewerPage, { width, height }]}>
                <Image
                  source={{ uri: image.url }}
                  style={{ width, height }}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
                {image.caption ? (
                  <Txt typography="t6" color="#fff" style={styles.viewerCaption}>
                    {pickI18nText(image.caption, lang)}
                  </Txt>
                ) : null}
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
function GalleryThumbnail({
  uri,
  caption,
  onOpen,
}: {
  uri: string;
  caption: string | null;
  onOpen: () => void;
}) {
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
        style={styles.thumb}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
        accessibilityLabel={caption ?? undefined}
      />
      {caption ? (
        <Txt typography="t7" color={SdsColors.grey600} numberOfLines={1} style={styles.caption}>
          {caption}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -SHEET_GUTTER, flexGrow: 0 },
  row: { paddingHorizontal: SHEET_GUTTER, gap: 6 },
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: SdsRadius.md,
    backgroundColor: SdsColors.grey100,
  },
  caption: { width: THUMB_WIDTH, marginTop: SdsSpacing.xs },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerPage: { justifyContent: 'center', alignItems: 'center' },
  viewerCaption: {
    position: 'absolute',
    bottom: 64,
    left: 20,
    right: 20,
    textAlign: 'center',
  },
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
