/**
 * SDUI Banner Carousel — auto-rotating image banners, e.g. the ESKARA student
 * banners above the campus sheet's service tiles.
 *
 * The loop (endless, paused while held, off-screen, backgrounded or under
 * reduce motion) is `LoopingPager`, shared with the home banner. Unlike home,
 * there is no built-in page: a carousel with no images draws nothing.
 *
 * Width follows the parent, like `ButtonGrid`, and caps at the same 480 so the
 * banner's edges line up with the tiles under it on a tablet too.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SdsColors, type HomeBannerImage, type SduiBannerCarousel } from '@skkuverse/shared';
import { LoopingPager } from '@/components/LoopingPager';
import { handleSduiAction } from '../action-handler';
import { logSduiContentSelect } from '@/services/analytics';

interface Props {
  section: SduiBannerCarousel;
}

/** `ButtonGrid`'s cap, so the two share both edges. */
const MAX_WIDTH = 480;

/** The sheet's gutter (16) plus its card inset (8) on each side, before the first layout. */
const ESTIMATED_SIDE_INSET = 24;

export function BannerCarousel({ section }: Props) {
  // A random first page per mount. A visit to the sheet is short next to a
  // full lap (28 banners × 4 s is about two minutes), so starting every visit
  // on the first banner would give the first few nearly all the exposure.
  const [seed] = useState(Math.random);
  const pages = useMemo(() => {
    const start = Math.floor(seed * section.items.length);
    return [...section.items.slice(start), ...section.items.slice(0, start)];
  }, [section.items, seed]);
  // From the server's order, not the rotated one, so a re-render never restarts the loop.
  const pageKey = useMemo(() => section.items.map((i) => i.id).join('|'), [section.items]);
  const { width: windowWidth } = useWindowDimensions();

  const renderPage = useCallback((i: number) => <ImagePage item={pages[i] as HomeBannerImage} />, [pages]);

  if (pages.length === 0) return null;

  return (
    <LoopingPager
      pageCount={pages.length}
      pageKey={pageKey}
      height={{
        forWidth: (w) => w / section.aspectRatio,
        estimatedWidth: Math.min(windowWidth - ESTIMATED_SIDE_INSET * 2, MAX_WIDTH),
      }}
      autoRotateMs={section.autoRotateSec * 1000}
      renderPage={renderPage}
      counter="bottomRight"
      style={styles.slot}
    />
  );
}

function ImagePage({ item }: { item: HomeBannerImage }) {
  const image = (
    <Image
      source={{ uri: item.imageUrl }}
      style={styles.image}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={150}
      accessible={!item.action}
      accessibilityLabel={item.alt}
    />
  );
  if (!item.action) return image;

  const { actionType, actionValue } = item.action;
  return (
    <Pressable
      style={({ pressed }) => [styles.image, { opacity: pressed ? 0.85 : 1 }]}
      onPress={() => {
        logSduiContentSelect({ content_type: 'banner', item_id: item.id });
        handleSduiAction({ actionType, actionValue });
      }}
      accessibilityRole="button"
      accessibilityLabel={item.alt}
    >
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The rounded clip lives on the slot, so every page is cut to the same card.
  // Radius and the gap below match the tiles.
  slot: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SdsColors.grey100,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
