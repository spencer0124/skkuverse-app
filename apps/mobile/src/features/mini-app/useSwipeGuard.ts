/**
 * The mini-app shell's guards around an iOS back swipe that is started and
 * let go (see `swipe-guard.ts` for why).
 *
 * `headerHeight` stands in for `useHeaderHeight()`: it holds still from the
 * moment the screen starts to leave until it has left or the swipe is
 * cancelled. `onScrollY`/`onLoadStart` feed it the WebView's scroll offset and
 * loads, and after a cancelled swipe that left the page near the top it
 * scrolls the page back.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigation } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import type { ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { WebView } from 'react-native-webview';
import { scrollToRestore, stableHeaderHeight } from './swipe-guard';

/**
 * How long after the cancel to look at the offset. The screen's layout comes
 * back asynchronously (a Fabric state update), so a reset can land a few frames
 * after the `gestureCancel` event.
 */
const RESTORE_DELAY_MS = 150;

export function useSwipeGuard(webRef: RefObject<WebView | null>) {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  // ── Header height, frozen while the screen is leaving ──
  const reported = useHeaderHeight();
  const [closing, setClosing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(reported);
  // Derived during render rather than in an effect, so the layout never paints
  // one frame with the value it should have ignored.
  const next = stableHeaderHeight(headerHeight, reported, closing);
  if (next !== headerHeight) setHeaderHeight(next);

  // ── Scroll offset around a cancelled swipe ──
  const scrollY = useRef(0);
  const loads = useRef(0);
  const snapshot = useRef<{ y: number; loads: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScrollY = useCallback((y: number) => {
    scrollY.current = y;
  }, []);
  const onLoadStart = useCallback(() => {
    loads.current += 1;
  }, []);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const offStart = navigation.addListener('transitionStart', (e) => {
      if (!e.data.closing) return;
      setClosing(true);
      snapshot.current = { y: scrollY.current, loads: loads.current };
    });
    const offEnd = navigation.addListener('transitionEnd', () => {
      setClosing(false);
      snapshot.current = null;
    });
    const offCancel = navigation.addListener('gestureCancel', () => {
      setClosing(false);
      const before = snapshot.current;
      snapshot.current = null;
      if (!before) return;
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        // A load in between means a different page: its offset is its own.
        if (loads.current !== before.loads) return;
        const y = scrollToRestore(before.y, scrollY.current);
        if (y !== null) webRef.current?.injectJavaScript(`window.scrollTo(0, ${y}); true;`);
      }, RESTORE_DELAY_MS);
    });
    return () => {
      offStart();
      offEnd();
      offCancel();
      clearTimer();
    };
  }, [navigation, webRef]);

  return { headerHeight, onScrollY, onLoadStart };
}
