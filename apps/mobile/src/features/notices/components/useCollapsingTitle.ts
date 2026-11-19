import { useCallback, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

const FADE_MS = 160;

export function useCollapsingTitle() {
  const [opacity] = useState(() => new Animated.Value(0));
  const titleBottom = useRef(Number.POSITIVE_INFINITY);
  const isShown = useRef(false);

  const onTitleLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    titleBottom.current = y + height;
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentInset } = event.nativeEvent;
      // WHY: under a translucent header the content starts below an inset, so its visible top is offset plus inset.
      const shouldShow = contentOffset.y + contentInset.top > titleBottom.current;
      if (shouldShow === isShown.current) return;
      isShown.current = shouldShow;
      Animated.timing(opacity, { toValue: shouldShow ? 1 : 0, duration: FADE_MS, useNativeDriver: true }).start();
    },
    [opacity],
  );

  return { opacity, onScroll, onTitleLayout };
}
