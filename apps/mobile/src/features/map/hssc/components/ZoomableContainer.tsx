/**
 * Zoomable/pannable container for the HSSC building map SVG.
 *
 * Gesture composition:
 *   Exclusive(Simultaneous(Pinch, Pan), Tap)
 *   → Pinch/Pan take priority; Tap fires only when no pan/pinch occurred.
 *
 * Initial fit: height-based — map fills the available container height,
 * with horizontal overflow for panning.
 *
 * Exposes `animateTo(cx, cy, scale)` via ref for programmatic centering.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { View, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  clamp,
  runOnJS,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuverse/shared';
import { findElementAtPoint } from '../utils/findElementAtPoint';

export interface ZoomableContainerRef {
  /** Animate the view so that SVG point (cx, cy) is centered at the given scale. */
  animateTo: (cx: number, cy: number, targetScale: number) => void;
  /** Returns the current height-based fit scale (content fills container height). */
  getFitScale: () => number;
}

interface ZoomableContainerProps {
  /** SVG viewBox width */
  contentWidth: number;
  /** SVG viewBox height */
  contentHeight: number;
  /** Called when an interactive element is tapped. */
  onElementTap: (elementId: string) => void;
  /** Called when tapping a non-interactive area. */
  onBackgroundTap?: () => void;
  /** Called once after the first layout measurement is complete. */
  onReady?: () => void;
  children: ReactNode;
}

const MAX_SCALE = 3.0;
const TIMING_CONFIG = { duration: 400 };

export const ZoomableContainer = forwardRef<
  ZoomableContainerRef,
  ZoomableContainerProps
>(function ZoomableContainer(
  { contentWidth, contentHeight, onElementTap, onBackgroundTap, onReady, children },
  ref,
) {
  // ── Measure actual container size via onLayout ──
  // Use useWindowDimensions as initial estimate to avoid blank flash,
  // then correct with onLayout measurement.
  const dims = useWindowDimensions();
  const [containerW, setContainerW] = useState(dims.width);
  const [containerH, setContainerH] = useState(dims.height * 0.85); // rough estimate minus header+safe area
  const [measured, setMeasured] = useState(false);

  const onContainerLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      setContainerW(width);
      setContainerH(height);
      if (!measured) {
        setMeasured(true);
        // Update shared values with correct initial scale after layout
        const fitScale = height / contentHeight;
        scale.value = fitScale;
        savedScale.value = fitScale;
        onReady?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measured, contentHeight],
  );

  // ── Scale: height-based fitting ──
  const initialScale = containerH / contentHeight;
  const minScale = initialScale * 0.7;

  const scale = useSharedValue(initialScale);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(initialScale);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Store container dimensions in shared values for worklet access
  const cW = useSharedValue(containerW);
  const cH = useSharedValue(containerH);
  const minS = useSharedValue(minScale);
  // Sync state → shared values after render (avoid Reanimated strict mode warning)
  useEffect(() => {
    cW.value = containerW;
    cH.value = containerH;
    minS.value = minScale;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerW, containerH, minScale]);

  // ── Clamp translation to keep content visible ──
  const clampTranslation = useCallback(
    (tx: number, ty: number, s: number) => {
      'worklet';
      const scaledW = contentWidth * s;
      const scaledH = contentHeight * s;
      const maxTx = Math.max(0, (scaledW - cW.value) / 2);
      const maxTy = Math.max(0, (scaledH - cH.value) / 2);
      return {
        x: clamp(tx, -maxTx, maxTx),
        y: clamp(ty, -maxTy, maxTy),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentWidth, contentHeight],
  );

  // ── Gestures ──
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      'worklet';
      savedScale.value = scale.value;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      'worklet';
      const newScale = clamp(savedScale.value * e.scale, minS.value, MAX_SCALE);
      const ds = newScale / savedScale.value;
      const newTx = savedTranslateX.value + (1 - ds) * (focalX.value - cW.value / 2);
      const newTy = savedTranslateY.value + (1 - ds) * (focalY.value - cH.value / 2);
      scale.value = newScale;
      const clamped = clampTranslation(newTx, newTy, newScale);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .minDistance(10)
    .onStart(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const newTx = savedTranslateX.value + e.translationX;
      const newTy = savedTranslateY.value + e.translationY;
      const clamped = clampTranslation(newTx, newTy, scale.value);
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    })
    .onEnd(() => {
      'worklet';
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Hit-test runs on JS thread (findElementAtPoint is not a worklet)
  const handleTapHit = useCallback(
    (svgX: number, svgY: number) => {
      const elementId = findElementAtPoint(svgX, svgY);
      if (elementId) {
        onElementTap(elementId);
      } else {
        onBackgroundTap?.();
      }
    },
    [onElementTap, onBackgroundTap],
  );

  const tapGesture = Gesture.Tap()
    .maxDuration(300)
    .maxDistance(10)
    .onEnd((e) => {
      'worklet';
      // Inverse transform: container-local coord → SVG coord
      const svgX =
        (e.x - cW.value / 2 - translateX.value) / scale.value +
        contentWidth / 2;
      const svgY =
        (e.y - cH.value / 2 - translateY.value) / scale.value +
        contentHeight / 2;

      // Must run on JS thread — findElementAtPoint is not a worklet
      runOnJS(handleTapHit)(svgX, svgY);
    });

  const pinchPan = Gesture.Simultaneous(pinchGesture, panGesture);
  const composed = Gesture.Exclusive(pinchPan, tapGesture);

  // ── Animated style ──
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // ── Imperative handle ──
  useImperativeHandle(ref, () => ({
    getFitScale() {
      return containerH / contentHeight;
    },
    animateTo(cx: number, cy: number, targetScale: number) {
      const clampedScale = Math.min(Math.max(targetScale, minScale), MAX_SCALE);
      // Center SVG point (cx, cy) on container center
      const newTx = -(cx - contentWidth / 2) * clampedScale;
      const newTy = -(cy - contentHeight / 2) * clampedScale;
      const clamped = clampTranslation(newTx, newTy, clampedScale);

      scale.value = withTiming(clampedScale, TIMING_CONFIG);
      translateX.value = withTiming(clamped.x, TIMING_CONFIG);
      translateY.value = withTiming(clamped.y, TIMING_CONFIG);
      savedScale.value = clampedScale;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    },
  }));

  return (
    <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onContainerLayout}>
      {!measured ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={SdsColors.brand} />
        </View>
      ) : (
        <GestureDetector gesture={composed}>
          {/* Outer Animated.View = container size = touch coordinate reference */}
          <Animated.View style={{ flex: 1 }}>
            {/* Inner Animated.View = content size + transform */}
            <Animated.View
              style={[
                {
                  width: contentWidth,
                  height: contentHeight,
                  position: 'absolute',
                  left: (containerW - contentWidth) / 2,
                  top: (containerH - contentHeight) / 2,
                },
                animatedStyle,
              ]}
            >
              {children}
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
});
