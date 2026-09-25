import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import {
  SdsColors,
  type HomeBannerCarousel as HomeBannerCarouselSection,
  type HomeBannerImage,
  type HomeBannerItem,
} from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';
import { logHomeContentSelect } from '@/services/analytics';
import { HeroBanner } from './HeroBanner';

interface Props {
  section: HomeBannerCarouselSection;
}

/** A carousel with nothing left to show still shows the app's own banner. */
const DEFAULT_ONLY: readonly HomeBannerItem[] = [{ type: 'default' }];

const SLOT_MARGIN = 16;

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * The home screen's top banner slot, driven by the `banner_carousel` section of
 * `GET /ui/home`: server images plus, where the server placed it, the app's
 * built-in `HeroBanner`.
 *
 * A plain `ScrollView horizontal pagingEnabled`, the same pager the intro uses,
 * rather than react-native-pager-view: a native module would need a new
 * runtimeVersion, and this ships as an OTA update.
 *
 * Auto-advance stops whenever it would move something the user is not looking
 * at or is holding: while a finger is on it, while the home tab is not focused,
 * while the app is backgrounded, and entirely under the OS "reduce motion"
 * setting. A manual swipe restarts the timer from the page it lands on.
 */
export function HomeBannerCarousel({ section }: Props) {
  const pages = section.items.length > 0 ? section.items : DEFAULT_ONLY;
  const pageKey = useMemo(
    () => pages.map((p) => (p.type === 'image' ? p.id : 'default')).join('|'),
    [pages],
  );

  const scrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  const focused = useIsFocused();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  // A refetch that changes the pages starts the rotation over from the first.
  useEffect(() => {
    setIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [pageKey]);

  const canRotate =
    pages.length > 1 &&
    section.autoRotateSec > 0 &&
    width > 0 &&
    focused &&
    appActive &&
    !dragging &&
    !reducedMotion;

  // One timeout per page rather than an interval: every change of `index`,
  // manual or automatic, re-arms it, so a swipe never gets cut short by a tick
  // that was already due.
  useEffect(() => {
    if (!canRotate) return undefined;
    const timer = setTimeout(() => {
      const next = (index + 1) % pages.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, section.autoRotateSec * 1000);
    return () => clearTimeout(timer);
  }, [canRotate, index, pages.length, section.autoRotateSec, width]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = Math.round(e.nativeEvent.layout.width);
      if (next === width) return;
      setWidth(next);
      // Keep the current page in view across a width change (rotation, split view).
      scrollRef.current?.scrollTo({ x: index * next, animated: false });
    },
    [index, width],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setDragging(false);
      if (width === 0) return;
      const landed = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.min(Math.max(landed, 0), pages.length - 1));
    },
    [pages.length, width],
  );

  // An explicit height, not `aspectRatio` on the slot: Yoga resolved that
  // against the margins and drew the card ~28pt narrower than the grid below.
  // Until the first layout, the window width minus the slot's margins is the
  // estimate, so the card does not grow from zero.
  const height = (width || windowWidth - SLOT_MARGIN * 2) / section.aspectRatio;

  return (
    <View style={[styles.slot, { height }]} onLayout={onLayout}>
      {width > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={pages.length > 1}
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setDragging(true)}
          // A drag that settles without momentum never fires the momentum end.
          onScrollEndDrag={() => setDragging(false)}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          {pages.map((page) => (
            <View
              key={page.type === 'image' ? page.id : 'default'}
              style={{ width, height }}
            >
              {page.type === 'image' ? <ImagePage item={page} /> : <HeroBanner fill />}
            </View>
          ))}
        </ScrollView>
      )}

      {pages.length > 1 && (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>
            {index + 1} / {pages.length}
          </Text>
        </View>
      )}
    </View>
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
  // A count, not dots: dots in one colour vanish on either the light default
  // banner or a dark photo, and a dark pill reads on both.
  counter: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
});
