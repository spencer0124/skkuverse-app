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
 * A gallery of ONE is drawn whole instead: a pub's poster, at its own aspect,
 * as wide as the sheet allows up to `SOLO_MAX_WIDTH` and never taller than
 * `SOLO_MAX_HEIGHT`. Cropped into the rail's landscape thumbnail, a portrait
 * poster lost ~40% of itself; a strip of one had nothing to page across anyway.
 *
 * A plain React Native `ScrollView`, not one of gorhom's: a gorhom scrollable
 * cannot nest inside another (`Sheet.tsx`), and a horizontal one would not help
 * the sheet's own vertical drag anyway.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { XIcon } from 'phosphor-react-native';
import {
  pickI18nText,
  SdsColors,
  SdsRadius,
  SdsSpacing,
  SOLO_IMAGE_DEFAULT_ASPECT,
  soloImageSize,
  useSettingsStore,
  type PlaceImage,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { SHEET_GUTTER } from './layout';

const THUMB_WIDTH = 256;
const THUMB_HEIGHT = 192;
const SOLO_MAX_WIDTH = 320;
const SOLO_MAX_HEIGHT = 440;
/** `PlaceSheetScroll`'s content column. */
const SHEET_MAX_WIDTH = 600;

/**
 * Each lone photo's loaded aspect, by URL, so a sheet opened again starts at the
 * right height instead of the default's. Media keys are content-hashed, so a
 * URL's aspect never changes.
 */
const soloAspects = new Map<string, number>();

export function PlaceGallery({ images }: { images: readonly PlaceImage[] }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  // The photo the viewer was opened on, or `null` while it is shut. Only a
  // thumbnail tap and the close paths write it — see the note at the `Modal`.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const viewerRef = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();

  const closeViewer = useCallback(() => setOpenIndex(null), []);
  const positionViewer = useCallback(() => {
    if (openIndex !== null) {
      viewerRef.current?.scrollTo({ x: openIndex * width, animated: false });
    }
  }, [openIndex, width]);

  if (images.length === 0) return null;
  const solo = images.length === 1 ? images[0] : null;

  return (
    <>
      {solo ? (
        <SoloImage
          uri={solo.url}
          caption={solo.caption ? pickI18nText(solo.caption, lang) : null}
          onOpen={() => setOpenIndex(0)}
        />
      ) : (
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
              onOpen={() => setOpenIndex(index)}
            />
          ))}
        </ScrollView>
      )}

      {/* The pager must never write `openIndex`. iOS keeps a Modal's children
          mounted until its dismiss finishes, and Fabric's ScrollView emits
          `onMomentumScrollEnd` when it leaves the window — so a pager that
          tracked its page into this state reopened the viewer on every X. */}
      <Modal
        visible={openIndex !== null}
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

/**
 * A tap that opens the viewer, and not a drag that ends on the image.
 *
 * This also leaves an upward sheet drag alone once it passes the tap slop, even
 * if a nested ScrollView has not claimed it yet.
 */
function useTapNotDrag(onTap: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  return {
    onTouchStart: (event: GestureResponderEvent) => {
      start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      moved.current = false;
    },
    onTouchMove: (event: GestureResponderEvent) => {
      if (start.current === null) return;
      const dx = event.nativeEvent.pageX - start.current.x;
      const dy = event.nativeEvent.pageY - start.current.y;
      if (Math.hypot(dx, dy) > 8) moved.current = true;
    },
    onPress: () => {
      if (!moved.current) onTap();
    },
  };
}

function GalleryThumbnail({
  uri,
  caption,
  onOpen,
}: {
  uri: string;
  caption: string | null;
  onOpen: () => void;
}) {
  const tap = useTapNotDrag(onOpen);

  return (
    <Pressable accessibilityRole="imagebutton" {...tap}>
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

/**
 * A lone photo at its own aspect. `contain`, not `cover`: once the aspect has
 * loaded the two draw the same, and before it a wrong guess letterboxes on the
 * placeholder grey rather than cutting the poster.
 */
function SoloImage({
  uri,
  caption,
  onOpen,
}: {
  uri: string;
  caption: string | null;
  onOpen: () => void;
}) {
  const tap = useTapNotDrag(onOpen);
  const { width: windowWidth } = useWindowDimensions();
  const [aspect, setAspect] = useState(() => soloAspects.get(uri) ?? SOLO_IMAGE_DEFAULT_ASPECT);
  const size = useMemo(() => {
    const column = Math.min(windowWidth, SHEET_MAX_WIDTH) - 2 * SHEET_GUTTER;
    return soloImageSize(aspect, Math.min(column, SOLO_MAX_WIDTH), SOLO_MAX_HEIGHT);
  }, [aspect, windowWidth]);

  return (
    <Pressable accessibilityRole="imagebutton" style={styles.solo} {...tap}>
      <Image
        source={{ uri }}
        style={[styles.soloImage, size]}
        contentFit="contain"
        transition={150}
        onLoad={(event) => {
          const loaded = event.source.width / event.source.height;
          if (!Number.isFinite(loaded) || loaded <= 0) return;
          soloAspects.set(uri, loaded);
          setAspect(loaded);
        }}
        accessibilityIgnoresInvertColors
        accessibilityLabel={caption ?? undefined}
      />
      {caption ? (
        <Txt
          typography="t7"
          color={SdsColors.grey600}
          numberOfLines={1}
          style={[styles.soloCaption, { width: size.width }]}
        >
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
  solo: { alignSelf: 'flex-start' },
  soloImage: { borderRadius: SdsRadius.md, backgroundColor: SdsColors.grey100 },
  soloCaption: { marginTop: SdsSpacing.xs },
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
