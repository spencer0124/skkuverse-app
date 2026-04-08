import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';

import Svg, {
  Rect,
  Circle as SvgCircle,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
} from 'react-native-svg';

// ─── Brand tokens (identical to web) ─────────────────────────
const GREEN = '#2B5A3A';
const GREEN_LIGHT = '#3D7A52';

// ─── Animation configs (exact web CSS curves) ──────────────
// Web: cubic-bezier(0.34, 1.56, 0.64, 1) — Toss-style spring with 56% overshoot
const TOSS_SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);
// Web: cubic-bezier(0.16, 1, 0.3, 1)
const SMOOTH = Easing.bezier(0.16, 1, 0.3, 1);
// Web: cubic-bezier(0.0, 0.0, 0.2, 1)
const DECEL = Easing.bezier(0.0, 0.0, 0.2, 1);

// ─── Timeline (ms) — web's setTimeout delays ────────────────
const T = {
  SPLIT: 800,
  REVEAL: 1150,
  CHAR_1: 1150 + 80,
  CHAR_2: 1150 + 160,
  SETTLE: 1900,
  FINAL: 2600,
} as const;

// ─── Props ──────────────────────────────────────────────────
interface Props {
  isReady?: boolean;
  onDismiss?: () => void;
  showReplayHint?: boolean;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function SKKUverseSplash({
  isReady = false,
  onDismiss,
  showReplayHint = __DEV__,
}: Props) {
  const { width: screenW } = useWindowDimensions();

  // ── Responsive sizing ──
  const fontSize = Math.min(Math.max(screenW * 0.1, 42), 90);
  const revealTargetW = fontSize * 2.1;
  const glowSize = Math.min(600, screenW * 0.8);
  const lineTargetW = fontSize * 5;
  const subtitleFontSize = Math.min(Math.max(screenW * 0.02, 10.4), 13.6);
  const EM_BASE = 16;

  // ── Shared values ──────────────────────────────────────────
  const splitL = useSharedValue(0);
  const splitR = useSharedValue(0);
  const reveal = useSharedValue(0);
  // Per-char: SEPARATE opacity (fast ease) vs transform (slow spring with overshoot)
  // Web: opacity 0.45s ease, transform 0.85s cubic-bezier(0.34,1.56,0.64,1)
  const c1Opacity = useSharedValue(0);
  const c1Transform = useSharedValue(0);
  const c2Opacity = useSharedValue(0);
  const c2Transform = useSharedValue(0);
  const c1Shadow = useSharedValue(8);
  const c2Shadow = useSharedValue(8);
  const line = useSharedValue(0);
  const sub = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.5);
  const hint = useSharedValue(0);
  const dismiss = useSharedValue(0);

  // Waiting dots
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);
  const waitingOpacity = useSharedValue(0);

  const [settled, setSettled] = useState(false);
  const markSettled = useCallback(() => setSettled(true), []);

  // ── Orchestrator ───────────────────────────────────────────
  const play = useCallback(() => {
    splitL.value = 0;
    splitR.value = 0;
    reveal.value = 0;
    c1Opacity.value = 0;
    c1Transform.value = 0;
    c2Opacity.value = 0;
    c2Transform.value = 0;
    c1Shadow.value = 8;
    c2Shadow.value = 8;
    line.value = 0;
    sub.value = 0;
    glowOpacity.value = 0;
    glowScale.value = 0.5;
    hint.value = 0;
    dismiss.value = 0;
    waitingOpacity.value = 0;
    dot1.value = 0;
    dot2.value = 0;
    dot3.value = 0;
    setSettled(false);

    // Step 1 — split
    // 스꾸만 왼쪽으로 이동 (gap), 버스는 이동 없음 (유니와 붙음)
    splitL.value = withDelay(
      T.SPLIT,
      withTiming(1, { duration: 850, easing: TOSS_SPRING }),
    );

    // Step 2 — reveal 유니
    reveal.value = withDelay(
      T.REVEAL,
      withTiming(1, { duration: 900, easing: SMOOTH }),
    );
    // Per-char: opacity 0.45s ease (fast), transform 0.85s TOSS_SPRING (slow, 56% overshoot)
    // The character fades in quickly but OVERSHOOTS its position dramatically, then settles
    c1Opacity.value = withDelay(
      T.CHAR_1,
      withTiming(1, { duration: 450, easing: Easing.ease }),
    );
    c1Transform.value = withDelay(
      T.CHAR_1,
      withTiming(1, { duration: 850, easing: TOSS_SPRING }),
    );

    c2Opacity.value = withDelay(
      T.CHAR_2,
      withTiming(1, { duration: 450, easing: Easing.ease }),
    );
    c2Transform.value = withDelay(
      T.CHAR_2,
      withTiming(1, { duration: 850, easing: TOSS_SPRING }),
    );

    // Step 3 — per-char shadow: simulates web's filter blur(0.8px) → blur(0)
    c1Shadow.value = withDelay(
      T.CHAR_1,
      withTiming(0, { duration: 500, easing: Easing.ease }),
    );
    c2Shadow.value = withDelay(
      T.CHAR_2,
      withTiming(0, { duration: 500, easing: Easing.ease }),
    );

    line.value = withDelay(
      T.SETTLE + 100,
      withTiming(1, { duration: 900, easing: SMOOTH }),
    );
    sub.value = withDelay(
      T.SETTLE + 250,
      withTiming(1, { duration: 800, easing: SMOOTH }, (fin) => {
        if (fin) runOnJS(markSettled)();
      }),
    );
    glowOpacity.value = withDelay(
      T.SETTLE,
      withTiming(1, { duration: 1200, easing: DECEL }),
    );
    glowScale.value = withDelay(
      T.SETTLE,
      withTiming(1, { duration: 1600, easing: SMOOTH }),
    );

    if (showReplayHint) {
      hint.value = withDelay(T.FINAL + 600, withTiming(1, { duration: 1000 }));
    }
  }, [showReplayHint]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    play();
  }, [play]);

  // ── Waiting dots ──
  useEffect(() => {
    if (settled && !isReady) {
      waitingOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
      const pulse = (sv: SharedValue<number>, delay: number) => {
        sv.value = withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
              withTiming(0.2, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            false,
          ),
        );
      };
      pulse(dot1, 400);
      pulse(dot2, 550);
      pulse(dot3, 700);
    } else if (isReady) {
      waitingOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [settled, isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dismiss ──
  useEffect(() => {
    if (!isReady || !settled) return;
    hint.value = withTiming(0, { duration: 200 });
    dismiss.value = withDelay(
      300,
      withTiming(
        1,
        { duration: 400, easing: Easing.in(Easing.ease) },
        (fin) => {
          if (fin && onDismiss) runOnJS(onDismiss)();
        },
      ),
    );
  }, [isReady, settled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animated styles ────────────────────────────────────────

  const containerAnim = useAnimatedStyle(() => ({
    opacity: interpolate(dismiss.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(dismiss.value, [0, 1], [1, 1.04]) }],
  }));

  const glowAnim = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  // 스꾸 — web: translateX(-0.12em), delay 0s
  const leftAnim = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(splitL.value, [0, 1], [0, -(fontSize * 0.12)]) },
    ],
  }));

  // 버스 — web: translateX(0.12em), delay 50ms
  const rightAnim = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(splitR.value, [0, 1], [0, fontSize * 0.12]) },
    ],
  }));

  const revealAnim = useAnimatedStyle(() => ({
    maxWidth: interpolate(reveal.value, [0, 1], [0, revealTargetW]),
  }));

  // 유 — opacity + transform + textShadow (simulates web blur)
  const c1Anim = useAnimatedStyle(() => ({
    opacity: c1Opacity.value,
    textShadowColor: 'rgba(43, 90, 58, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: c1Shadow.value,
    transform: [
      { translateX: interpolate(c1Transform.value, [0, 1], [-(fontSize * 0.6), 0]) },
      { translateY: interpolate(c1Transform.value, [0, 1], [fontSize * 0.05, 0]) },
      { scale: interpolate(c1Transform.value, [0, 1], [0.88, 1]) },
    ],
  }));

  // 니 — same, 80ms later
  const c2Anim = useAnimatedStyle(() => ({
    opacity: c2Opacity.value,
    textShadowColor: 'rgba(43, 90, 58, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: c2Shadow.value,
    transform: [
      { translateX: interpolate(c2Transform.value, [0, 1], [-(fontSize * 0.6), 0]) },
      { translateY: interpolate(c2Transform.value, [0, 1], [fontSize * 0.05, 0]) },
      { scale: interpolate(c2Transform.value, [0, 1], [0.88, 1]) },
    ],
  }));

  const lineAnim = useAnimatedStyle(() => ({
    opacity: interpolate(line.value, [0, 1], [0, 0.35]),
  }));

  const lineRectProps = useAnimatedProps(() => ({
    width: interpolate(line.value, [0, 1], [0, lineTargetW]),
    x: interpolate(line.value, [0, 1], [lineTargetW / 2, 0]),
  }));

  const subAnim = useAnimatedStyle(() => ({
    opacity: sub.value,
    transform: [
      { translateY: interpolate(sub.value, [0, 1], [EM_BASE * 0.8, 0]) },
    ],
  }));

  const hintAnim = useAnimatedStyle(() => ({ opacity: hint.value }));
  const waitingAnim = useAnimatedStyle(() => ({ opacity: waitingOpacity.value }));
  const dot1Anim = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dot2Anim = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dot3Anim = useAnimatedStyle(() => ({ opacity: dot3.value }));

  // ── Render ─────────────────────────────────────────────────

  const textBase = [
    s.mainText,
    {
      fontSize,
      letterSpacing: fontSize * -0.04,
      lineHeight: fontSize * 1.3,
    },
  ] as const;

  return (
    <Animated.View style={[s.root, containerAnim]}>
      {/* ── Radial glow (SVG RadialGradient — exact web match) ──
           Web: radial-gradient(circle, rgba(43,90,58,0.08) 0%, transparent 70%) */}
      <Animated.View
        style={[
          s.glowWrap,
          { width: glowSize, height: glowSize },
          glowAnim,
        ]}
      >
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <SvgRadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={GREEN} stopOpacity={0.08} />
              <Stop offset="0.7" stopColor={GREEN} stopOpacity={0} />
              <Stop offset="1" stopColor={GREEN} stopOpacity={0} />
            </SvgRadialGradient>
          </Defs>
          <SvgCircle
            cx={glowSize / 2}
            cy={glowSize / 2}
            r={glowSize / 2}
            fill="url(#glow)"
          />
        </Svg>
      </Animated.View>

      <Pressable onPress={play} style={s.content}>
        {/* ── Wordmark row ── */}
        <View style={s.row}>
          <Animated.Text style={[...textBase, leftAnim]}>스꾸</Animated.Text>

          <Animated.View style={[s.reveal, revealAnim]}>
            <View style={[s.charRow, { gap: fontSize * 0.01 }]}>
              <Animated.Text style={[...textBase, c1Anim]}>유</Animated.Text>
              <Animated.Text style={[...textBase, c2Anim]}>니</Animated.Text>
            </View>
          </Animated.View>

          <Animated.Text style={[...textBase, rightAnim]}>버스</Animated.Text>
        </View>

        {/* ── Accent line (SVG LinearGradient) ──
             Web: linear-gradient(90deg, transparent, #3D7A52, transparent) */}
        <Animated.View style={[s.lineWrap, { marginTop: EM_BASE * 0.7 }, lineAnim]}>
          <Svg width={lineTargetW} height={3} viewBox={`0 0 ${lineTargetW} 3`}>
            <Defs>
              <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={GREEN_LIGHT} stopOpacity={0} />
                <Stop offset="0.5" stopColor={GREEN_LIGHT} stopOpacity={1} />
                <Stop offset="1" stopColor={GREEN_LIGHT} stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>
            <AnimatedRect
              y={0}
              height={3}
              rx={1.5}
              fill="url(#lineGrad)"
              animatedProps={lineRectProps}
            />
          </Svg>
        </Animated.View>

        {/* ── Subtitle ── */}
        <Animated.Text
          style={[
            s.subtitle,
            {
              fontSize: subtitleFontSize,
              letterSpacing: subtitleFontSize * 0.28,
              marginTop: EM_BASE * 0.85,
            },
            subAnim,
          ]}
        >
          SKKUverse
        </Animated.Text>

      </Pressable>

      {/* ── Waiting dots ── */}
      <Animated.View style={[s.dotsWrap, waitingAnim]}>
        <Animated.View style={[s.dot, dot1Anim]} />
        <Animated.View style={[s.dot, dot2Anim]} />
        <Animated.View style={[s.dot, dot3Anim]} />
      </Animated.View>

      {/* ── Dev replay hint ── */}
      {showReplayHint && (
        <Animated.View style={[s.hintWrap, hintAnim]}>
          <Text style={s.hintText}>TAP TO REPLAY</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Glow
  glowWrap: {
    position: 'absolute',
  },

  // Content — full width so children stay centered as wordmark grows
  content: {
    width: '100%',
    alignItems: 'center',
  },

  // Wordmark
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mainText: {
    fontFamily: 'IBMPlexSansKR-Bold',
    fontWeight: '700',
    color: GREEN,
  },
  reveal: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  charRow: {
    flexDirection: 'row',
  },

  // Accent line
  lineWrap: {
    height: 3,
    overflow: 'hidden',
  },

  // Subtitle
  subtitle: {
    textAlign: 'center',
    fontFamily: 'IBMPlexSansKR-SemiBold',
    fontWeight: '600',
    color: GREEN_LIGHT,
    textTransform: 'uppercase',
  },

  // Waiting dots
  dotsWrap: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GREEN_LIGHT,
  },

  // Dev hint
  hintWrap: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: '#c8c8c8',
    textTransform: 'uppercase',
  },
});
