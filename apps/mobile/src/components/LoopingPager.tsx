import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  StyleSheet,
  Text,
  View,
  VirtualizedList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Virtual page count for the endless loop. The list starts in the middle, so
 * there are ~5,000 pages of runway either way — about seven hours of 5-second
 * auto-advance, or a lot of swiping — and only the pages near the viewport are
 * ever mounted. Reaching an end jumps back to the middle without animation.
 */
const LOOP_PAGES = 10_000;

interface Slide {
  /** Virtual position in the loop; the page shown is `index % pageCount`. */
  index: number;
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** The virtual index nearest the middle of the loop that shows `page`. */
function middleOf(n: number, page = 0): number {
  return Math.floor(LOOP_PAGES / 2 / n) * n + page;
}

interface Props {
  pageCount: number;
  /** Changes whenever the pages do; the loop then starts over from the first. */
  pageKey: string;
  /**
   * The pager's height for a given width, and the width to size by before the
   * first layout (so the slot does not grow from zero). Left out, the pager is
   * as tall as its pages.
   */
  height?: { forWidth(width: number): number; estimatedWidth: number };
  /** Time on each page before moving on; 0 never moves by itself. */
  autoRotateMs: number;
  /**
   * One page. `current` is whether it is the page on screen — a page can
   * replay something each time it comes round (the default banner's morph).
   */
  renderPage(page: number, current: boolean): ReactNode;
  /** The page on screen changed (by the timer or a swipe). */
  onPageChange?(page: number): void;
  /** Where the "1 / 2" count sits; never drawn for a single page. */
  counter: 'topRight' | 'bottomRight';
  /** The slot: margins, the rounded clip, a background. */
  style?: StyleProp<ViewStyle>;
}

/**
 * An endless carousel that only ever advances to the right (1 → 2 → 1 → 2 …):
 * a paging VirtualizedList over a long run of virtual pages, each showing
 * `index % pageCount`. Nothing ever rewinds across the strip or swaps clones
 * mid-swipe, and a drag works in both directions. A plain RN list rather than
 * a pager module, because this ships as an OTA update.
 *
 * Auto-advance stops whenever it would move something the user is not looking
 * at or is holding: while a finger is on it, while its screen is not focused,
 * while the app is backgrounded, and entirely under the OS "reduce motion"
 * setting. A manual swipe restarts the timer from the page it lands on.
 *
 * Shared by the home banner and the home Hall of Fame.
 */
export function LoopingPager({
  pageCount,
  pageKey,
  height: sizing,
  autoRotateMs,
  renderPage,
  onPageChange,
  counter,
  style,
}: Props) {
  const n = pageCount;
  const looping = n > 1;

  const listRef = useRef<VirtualizedList<Slide>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(() => (looping ? middleOf(n) : 0));
  const [dragging, setDragging] = useState(false);

  const focused = useIsFocused();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  // A change of pages starts over from the first. Reset during render rather
  // than in an effect: the list is keyed on pageKey, and it must remount with
  // the new index as its initialScrollIndex, not the old one.
  const [seenPageKey, setSeenPageKey] = useState(pageKey);
  if (seenPageKey !== pageKey) {
    setSeenPageKey(pageKey);
    setIndex(looping ? middleOf(n) : 0);
  }

  const page = n > 0 ? index % n : 0;
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  useEffect(() => {
    onPageChangeRef.current?.(page);
  }, [page]);

  const canRotate = looping && autoRotateMs > 0 && width > 0 && focused && appActive && !dragging && !reducedMotion;

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
    }, autoRotateMs);
    return () => clearTimeout(timer);
  }, [canRotate, index, n, autoRotateMs, width]);

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

  const getItem = useCallback((_: unknown, i: number): Slide => ({ index: i }), []);
  const getItemLayout = useCallback((_: unknown, i: number) => ({ length: width, offset: width * i, index: i }), [width]);

  // An explicit height, not `aspectRatio` on the slot: Yoga resolved that
  // against the margins and drew the card narrower than the rows around it.
  const height = sizing?.forWidth(width || sizing.estimatedWidth);

  const renderItem = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={{ width, height }}>{renderPage(item.index % n, item.index === index)}</View>
    ),
    [height, index, n, renderPage, width],
  );

  return (
    <View style={[style, height !== undefined && { height }]} onLayout={onLayout}>
      {width > 0 && n > 0 && (
        <VirtualizedList<Slide>
          key={`${pageKey}:${width}`}
          ref={listRef}
          data={pageKey}
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
        <View style={[styles.counter, counter === 'topRight' ? styles.topRight : styles.bottomRight]} pointerEvents="none">
          <Text style={styles.counterText}>
            {page + 1} / {n}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // A count, not dots: dots in one colour vanish on either the light default
  // banner or a dark photo, and a dark pill reads on both.
  counter: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  topRight: { right: 10, top: 10 },
  bottomRight: { right: 10, bottom: 8 },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
});
