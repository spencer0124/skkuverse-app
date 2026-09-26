import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Txt } from '@skkuverse/sds';
import { SdsColors } from '@skkuverse/shared';

interface Props {
  label: string;
  durationMs: number;
  /** Draining; false holds the fill where it is (an ad on screen, the app in the background). */
  running: boolean;
  /** Time is up, or the offer is gone: the button greys out. */
  done: boolean;
  /** Pressable now (an ad is loaded and time is left). */
  enabled: boolean;
  /** Show a spinner in place of nothing — the ad is loading or playing. */
  busy: boolean;
  onPress(): void;
  onExpire(): void;
}

const FILL = SdsColors.brand;
const BASE = '#D3EDE0';

/**
 * A button that is its own timer: its fill drains from right to left, and
 * when it is empty the button is spent. No number to read — the shrinking
 * colour says how long is left.
 *
 * The label is drawn twice, dark on the pale track and white on the fill,
 * with the fill clipping its copy, so it stays crisp wherever the edge is.
 * The JS clock decides when time is up; the fill only draws it, on the UI
 * thread, and a held fill resumes exactly where it stopped.
 */
export function DrainButton({ label, durationMs, running, done, enabled, busy, onPress, onExpire }: Props) {
  const remaining = useRef(durationMs);
  const progress = useSharedValue(1);
  const [width, setWidth] = useState(0);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (done) {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 200 });
      return;
    }
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    const startedAt = Date.now();
    const left = remaining.current;
    progress.value = withTiming(0, { duration: left, easing: Easing.linear });
    const timeout = setTimeout(() => {
      remaining.current = 0;
      expire.current();
    }, left);
    return () => {
      clearTimeout(timeout);
      remaining.current = Math.max(0, left - (Date.now() - startedAt));
    };
  }, [running, done, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (done) {
    return (
      <View style={[styles.button, styles.spent]}>
        <Txt typography="t5" fontWeight="bold" color={SdsColors.grey400}>
          {label}
        </Txt>
      </View>
    );
  }

  const content = (color: string) =>
    busy ? (
      <ActivityIndicator color={color} />
    ) : (
      <Txt typography="t5" fontWeight="bold" color={color}>
        {label}
      </Txt>
    );

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      onLayout={onLayout}
      style={({ pressed }) => [styles.button, styles.track, pressed && styles.pressed]}
    >
      {content(SdsColors.brand)}
      <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]}>
        <View style={[styles.fillInner, { width }]}>{content('#FFFFFF')}</View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  track: { backgroundColor: BASE },
  spent: { backgroundColor: SdsColors.grey100 },
  pressed: { transform: [{ scale: 0.98 }] },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: FILL },
  fillInner: { height: '100%', alignItems: 'center', justifyContent: 'center' },
});
