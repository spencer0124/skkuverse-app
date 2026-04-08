import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const GREEN = '#2B5A3A';

interface Props {
  isReady?: boolean;
  onDismiss?: () => void;
  showReplayHint?: boolean;
}

export function SKKUverseSplash({
  isReady = false,
  onDismiss,
}: Props) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!isReady) return;
    opacity.value = withTiming(
      0,
      { duration: 400, easing: Easing.in(Easing.ease) },
      (fin) => {
        if (fin && onDismiss) runOnJS(onDismiss)();
      },
    );
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const containerAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[s.root, containerAnim]}>
      <Text style={s.text}>스꾸버스</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'IBMPlexSansKR-Bold',
    fontWeight: '700',
    fontSize: 42,
    color: GREEN,
    letterSpacing: -1.5,
  },
});
