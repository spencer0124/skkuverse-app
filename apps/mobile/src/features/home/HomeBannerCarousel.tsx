import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import {
  SdsColors,
  type HomeBannerCarousel as HomeBannerCarouselSection,
  type HomeBannerImage,
  type HomeBannerItem,
} from '@skkuverse/shared';
import { LoopingPager } from '@/components/LoopingPager';
import { handleSduiAction } from '@/sdui/action-handler';
import { logHomeContentSelect } from '@/services/analytics';
import { HeroBanner } from './HeroBanner';

interface Props {
  section: HomeBannerCarouselSection;
}

/** A carousel with nothing left to show still shows the app's own banner. */
const DEFAULT_ONLY: readonly HomeBannerItem[] = [{ type: 'default' }];

const SLOT_MARGIN = 16;

/**
 * The home screen's top banner slot, driven by the `banner_carousel` section of
 * `GET /ui/home`: server images plus, where the server placed it, the app's
 * built-in `HeroBanner`. The loop itself — endless, auto-advancing, paused
 * whenever nobody is looking — is `LoopingPager`.
 */
export function HomeBannerCarousel({ section }: Props) {
  const pages = section.items.length > 0 ? section.items : DEFAULT_ONLY;
  const looping = pages.length > 1;
  const pageKey = useMemo(() => pages.map((p) => (p.type === 'image' ? p.id : 'default')).join('|'), [pages]);
  const { width: windowWidth } = useWindowDimensions();

  const renderPage = useCallback(
    (i: number, current: boolean) => {
      const page = pages[i] as HomeBannerItem;
      return page.type === 'image' ? (
        <ImagePage item={page} />
      ) : (
        // Replays its morph each time it becomes the current page. As the
        // only page it is always current, so it keeps its standalone loop.
        <HeroBanner fill active={looping ? current : undefined} />
      );
    },
    [pages, looping],
  );

  return (
    <LoopingPager
      pageCount={pages.length}
      pageKey={pageKey}
      height={{ forWidth: (w) => w / section.aspectRatio, estimatedWidth: windowWidth - SLOT_MARGIN * 2 }}
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
        logHomeContentSelect({ content_type: 'banner', item_id: item.id });
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
  // Margins and the rounded clip live on the slot, not the pages, so every page
  // — an image or the built-in banner — is cut to the same card.
  slot: {
    marginHorizontal: SLOT_MARGIN,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SdsColors.brandLight,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
