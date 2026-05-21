import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withDelay,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { SdsColors, SdsShadows } from '@skkuverse/shared';

// Cycle: morph (~2.7s) → 5s idle hold → snap reset → loop.
const ACTIVE_DURATION = 2700;
const IDLE_HOLD = 5000;

// Animation flow:
//   0–SPREAD_START   : "스꾸 버스" held tight (1-space gap, both slots
//                      translated inward toward each other)
//   SPREAD           : slots translate outward to their natural (final-state)
//                      positions — "스꾸" lands at "성균관"'s center, "버스"
//                      lands at "유니버스"'s center
//   LEFT_VSWAP       : "스꾸" → "성균관" vertical text swap, in place
//   pause (~1s)      : implicit, between LEFT_VSWAP_END and RIGHT_VSWAP_START
//   RIGHT_VSWAP      : "버스" → "유니버스" vertical text swap, in place
//   …END–1.0         : final state held
//   +IDLE_HOLD       : 5-second wait, then snap reset, loop
const SPREAD_START = 0.05;
const SPREAD_END = 0.2;
const LEFT_VSWAP_START = 0.25;
const LEFT_VSWAP_END = 0.35;
const RIGHT_VSWAP_START = 0.72;
const RIGHT_VSWAP_END = 0.82;

// 쫀득 easing curves. Same shape as SKKUverseSplash.animated.tsx's
// TOSS_SPRING/SMOOTH, but built via Easing.bezierFn (returns a plain
// (t)=>number) so they can be invoked directly inside useAnimatedStyle.
// Easing.bezier returns an EasingFunctionFactory meant for withTiming; the
// `Fn` variant is the direct-call equivalent.
//
// TOSS_SPRING — 56% overshoot — reserved for moves with no clipping boundary
// (slot translateX). SMOOTH stays within [0,1] output — required for
// translateY inside overflow:hidden slots, where overshoot would briefly
// poke text past the slot edge.
const TOSS_SPRING = Easing.bezierFn(0.34, 1.56, 0.64, 1);
const SMOOTH = Easing.bezierFn(0.16, 1, 0.3, 1);

// Worklet helper: maps master progress → local-phase progress in [0,1], then
// applies the supplied curve. Each animated style picks its own curve while
// sharing one linear master clock — no drift across loop cycles, no race
// between independent withSpring shared values.
function easedPhase(
  value: number,
  start: number,
  end: number,
  curve: (t: number) => number,
): number {
  'worklet';
  const t = (value - start) / (end - start);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return curve(clamped);
}

// Web has subhead and wordmark at the same fontSize (104px desktop). Match
// that here for visual symmetry — banner uses 28dp for both.
const HEADING_FONT = 28;
const SLOT_HEIGHT = HEADING_FONT;
// One space character width at fontSize 28 bold WantedSans.
const SLOT_GAP = HEADING_FONT * 0.28;

// Slot widths sized to LONG (final) texts plus ~1dp safety margin per side
// so rendered glyphs never clip. textAlign:center distributes any slack
// equally on both sides — short initial-state texts ("스꾸"/"버스") sit
// centered in their LONG slots.
const LEFT_LONG_WIDTH = HEADING_FONT * 2.7; // "성균관" ≈ 73.92 + buffer
const RIGHT_LONG_WIDTH = HEADING_FONT * 3.55; // "유니버스" ≈ 98.28 + buffer
// Short-text width ("스꾸" / "버스") used to compute tight-state translate.
const SHORT_TEXT_WIDTH = HEADING_FONT * 1.7;

// Tight-state translateX. Derived so that in the tight state, "스꾸" and
// "버스" centers are exactly SLOT_GAP + SHORT_TEXT_WIDTH apart — same
// 1-space visible gap as the final "성균관 유니버스" pair.
//
// Math: in the natural (untranslated) layout, left slot's center is at
// card_center − (SLOT_GAP + RIGHT_LONG_WIDTH)/2. We want "스꾸"'s center
// (= left slot's center) at card_center − (SLOT_GAP + SHORT_TEXT_WIDTH)/2
// in the tight state. The difference is the inward-translate amount.
const LEFT_TIGHT_TRANSLATE = (RIGHT_LONG_WIDTH - SHORT_TEXT_WIDTH) / 2;
const RIGHT_TIGHT_TRANSLATE = -(LEFT_LONG_WIDTH - SHORT_TEXT_WIDTH) / 2;

type EmojiSpec = {
  ch: string;
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  rot: number;
  delay: number;
};

const EMOJIS: readonly EmojiSpec[] = [
  { ch: '\u{1F4E2}', left: '42%', top: '60%', size: 36, rot: -8, delay: 0 },
  { ch: '\u{1F68C}', left: '66%', top: '52%', size: 28, rot: 6, delay: 800 },
  { ch: '\u{1F4DA}', left: '24%', top: '54%', size: 24, rot: -12, delay: 1400 },
  { ch: '\u{1F5FA}', left: '20%', top: '80%', size: 26, rot: -5, delay: 2000 },
  { ch: '\u{23F0}', left: '70%', top: '80%', size: 24, rot: 5, delay: 2600 },
  { ch: '\u{1F514}', left: '52%', top: '82%', size: 20, rot: 10, delay: 3200 },
];

export function HeroBanner() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ACTIVE_DURATION,
          easing: Easing.linear,
        }),
        withDelay(IDLE_HOLD, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [progress]);

  // SPREAD phase uses TOSS_SPRING (56% overshoot) — slots fly outward, settle
  // back. translate = TIGHT * (1 − eased): at eased=0 → TIGHT, at eased=1 → 0.
  const leftSlotStyle = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      SPREAD_START,
      SPREAD_END,
      TOSS_SPRING,
    );
    return {
      transform: [{ translateX: LEFT_TIGHT_TRANSLATE * (1 - eased) }],
    };
  });

  const rightSlotStyle = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      SPREAD_START,
      SPREAD_END,
      TOSS_SPRING,
    );
    return {
      transform: [{ translateX: RIGHT_TIGHT_TRANSLATE * (1 - eased) }],
    };
  });

  // VSWAP phases use SMOOTH (no overshoot) — text never pokes past slot edge.
  // row1 (exiting): translateY = -SLOT_HEIGHT * eased  (0 → -SLOT_HEIGHT)
  // row2 (entering): translateY = SLOT_HEIGHT * (1 − eased)  (SLOT_HEIGHT → 0)
  const leftRow1Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      LEFT_VSWAP_START,
      LEFT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: -SLOT_HEIGHT * eased }],
    };
  });

  const leftRow2Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      LEFT_VSWAP_START,
      LEFT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: SLOT_HEIGHT * (1 - eased) }],
    };
  });

  const rightRow1Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      RIGHT_VSWAP_START,
      RIGHT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: -SLOT_HEIGHT * eased }],
    };
  });

  const rightRow2Style = useAnimatedStyle(() => {
    const eased = easedPhase(
      progress.value,
      RIGHT_VSWAP_START,
      RIGHT_VSWAP_END,
      SMOOTH,
    );
    return {
      transform: [{ translateY: SLOT_HEIGHT * (1 - eased) }],
    };
  });

  return (
    <View style={styles.card}>
      <Text style={styles.subhead}>내 손 안에, 성균관대</Text>

      <View style={styles.wordmarkRow}>
        <Animated.View style={[styles.leftSlot, leftSlotStyle]}>
          <Animated.View style={[styles.row, leftRow1Style]}>
            <Text style={styles.wordmark}>스꾸</Text>
          </Animated.View>
          <Animated.View style={[styles.row, leftRow2Style]}>
            <Text style={styles.wordmark}>성균관</Text>
          </Animated.View>
        </Animated.View>

        <View style={styles.slotGap} />

        <Animated.View style={[styles.rightSlot, rightSlotStyle]}>
          <Animated.View style={[styles.row, rightRow1Style]}>
            <Text style={styles.wordmark}>버스</Text>
          </Animated.View>
          <Animated.View style={[styles.row, rightRow2Style]}>
            <Text style={styles.wordmark}>유니버스</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <FloatingEmoji spec={EMOJIS[0]} />
      <FloatingEmoji spec={EMOJIS[1]} />
      <FloatingEmoji spec={EMOJIS[2]} />
      <FloatingEmoji spec={EMOJIS[3]} />
      <FloatingEmoji spec={EMOJIS[4]} />
      <FloatingEmoji spec={EMOJIS[5]} />
    </View>
  );
}

function FloatingEmoji({ spec }: { spec: EmojiSpec }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withDelay(
      spec.delay,
      withRepeat(
        withTiming(1, {
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      ),
    );
  }, [bob, spec.delay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, -10]) },
      { rotate: `${spec.rot}deg` },
    ],
  }));

  return (
    <Animated.Text
      style={[
        styles.emoji,
        {
          left: spec.left,
          top: spec.top,
          fontSize: spec.size,
          lineHeight: spec.size * 1.2,
        },
        animStyle,
      ]}
    >
      {spec.ch}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 240,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: SdsColors.brandLight,
    paddingHorizontal: 24,
    paddingTop: 28,
    overflow: 'hidden',
    boxShadow: SdsShadows.card.boxShadow,
    ...SdsShadows.card.legacy,
  },
  subhead: {
    fontFamily: 'WantedSans',
    fontWeight: '700',
    fontSize: HEADING_FONT,
    lineHeight: HEADING_FONT * 1.2,
    color: SdsColors.grey900,
    letterSpacing: -HEADING_FONT * 0.03,
    textAlign: 'center',
  },
  wordmarkRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  leftSlot: {
    width: LEFT_LONG_WIDTH,
    height: SLOT_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  rightSlot: {
    width: RIGHT_LONG_WIDTH,
    height: SLOT_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  slotGap: {
    width: SLOT_GAP,
  },
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  wordmark: {
    fontFamily: 'WantedSans',
    fontWeight: '700',
    fontSize: HEADING_FONT,
    lineHeight: SLOT_HEIGHT,
    color: SdsColors.brandDark,
    letterSpacing: -HEADING_FONT * 0.03,
    textAlign: 'center',
  },
  emoji: {
    position: 'absolute',
    fontFamily: 'TossFaceFontMac',
  },
});
