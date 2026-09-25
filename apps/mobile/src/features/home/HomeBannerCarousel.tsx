import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  VirtualizedList,
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

/**
 * Virtual page count for the endless loop. The list starts in the middle, so
 * there are ~5,000 pages of runway either way — about seven hours of 5-second
 * auto-advance, or a lot of swiping — and only the pages near the viewport are
 * ever mounted. Reaching an end jumps back to the middle without animation.
 */
const LOOP_PAGES = 10_000;

interface Slide {
  /** Virtual position in the loop; the page shown is `pages[index % n]`. */
  index: number;
  page: HomeBannerItem;
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** The virtual index nearest the middle of the loop that shows `pageIndex`. */
function middleOf(n: number, pageIndex = 0): number {
  return Math.floor(LOOP_PAGES / 2 / n) * n + pageIndex;
}

/**
 * The home screen's top banner slot, driven by the `banner_carousel` section of
 * `GET /ui/home`: server images plus, where the server placed it, the app's
 * built-in `HeroBanner`.
 *
 * An endless loop that only ever advances to the right (1 → 2 → 1 → 2 …): a
 * paging VirtualizedList over a long run of virtual pages, each showing
 * `pages[index % n]`. Nothing ever rewinds across the strip or swaps clones
 * mid-swipe, and a drag works in both directions. A plain RN list rather than
 * a pager module, because this ships as an OTA update.
 *
 * Auto-advance stops whenever it would move something the user is not looking
 * at or is holding: while a finger is on it, while the home tab is not focused,
 * while the app is backgrounded, and entirely under the OS "reduce motion"
 * setting. A manual swipe restarts the timer from the page it lands on.
 */
export function HomeBannerCarousel({ section }: Props) {
  const pages = section.items.length > 0 ? section.items : DEFAULT_ONLY;
  const n = pages.length;
  const looping = n > 1;
  const pageKey = useMemo(
    () => pages.map((p) => (p.type === 'image' ? p.id : 'default')).join('|'),
    [pages],
  );

  const listRef = useRef<VirtualizedList<Slide>>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(() => (looping ? middleOf(n) : 0));
  const [dragging, setDragging] = useState(false);

  const focused = useIsFocused();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  // A refetch that changes the pages starts over from the first. Reset during
  // render rather than in an effect: the list is keyed on pageKey, and it must
  // remount with the new index as its initialScrollIndex, not the old one.
  const [seenPageKey, setSeenPageKey] = useState(pageKey);
  if (seenPageKey !== pageKey) {
    setSeenPageKey(pageKey);
    setIndex(looping ? middleOf(n) : 0);
  }

  const canRotate =
    looping &&
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
      const next = index + 1;
      if (next >= LOOP_PAGES - 1) {
        // The end of the runway: the same page, back in the middle.
        const back = middleOf(n, next % n);
        listRef.current?.scrollToOffset({ offset: back * width, animated: false });
        setIndex(back);
        return;
      }
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, section.autoRotateSec * 1000);
    return () => clearTimeout(timer);
  }, [canRotate, index, n, section.autoRotateSec, width]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = Math.round(e.nativeEvent.layout.width);
      // The list is keyed on width, so it remounts at `index` for the new size.
      if (next !== width) setWidth(next);
    },
    [width],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setDragging(false);
      if (width === 0) return;
      const landed = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.min(Math.max(landed, 0), (looping ? LOOP_PAGES : 1) - 1));
    },
    [looping, width],
  );

  const getItem = useCallback(
    (_: unknown, i: number): Slide => ({ index: i, page: pages[i % n] as HomeBannerItem }),
    [pages, n],
  );
  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({ length: width, offset: width * i, index: i }),
    [width],
  );

  // An explicit height, not `aspectRatio` on the slot: Yoga resolved that
  // against the margins and drew the card ~28pt narrower than the grid below.
  // Until the first layout, the window width minus the slot's margins is the
  // estimate, so the card does not grow from zero.
  const height = (width || windowWidth - SLOT_MARGIN * 2) / section.aspectRatio;

  const renderItem = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={{ width, height }}>
        {item.page.type === 'image' ? (
          <ImagePage item={item.page} />
        ) : (
          // Replays its morph each time it becomes the current page. As the
          // only page it is always current, so it keeps its standalone loop.
          <HeroBanner fill active={looping ? item.index === index : undefined} />
        )}
      </View>
    ),
    [height, index, looping, width],
  );

  return (
    <View style={[styles.slot, { height }]} onLayout={onLayout}>
      {width > 0 && (
        <VirtualizedList<Slide>
          key={`${pageKey}:${width}`}
          ref={listRef}
          data={pages}
          getItemCount={() => (looping ? LOOP_PAGES : 1)}
          getItem={getItem}
          getItemLayout={getItemLayout}
          keyExtractor={(item) => String(item.index)}
          renderItem={renderItem}
          extraData={index}
          initialScrollIndex={index}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          horizontal
          pagingEnabled
          scrollEnabled={looping}
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setDragging(true)}
          // A drag that settles without momentum never fires the momentum end.
          onScrollEndDrag={() => setDragging(false)}
          onMomentumScrollEnd={onMomentumScrollEnd}
        />
      )}

      {looping && (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterText}>
            {(index % n) + 1} / {n}
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
