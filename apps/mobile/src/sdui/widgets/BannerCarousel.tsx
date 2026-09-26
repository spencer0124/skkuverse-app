/**
 * SDUI Banner Carousel — auto-rotating image banners, e.g. the ESKARA student
 * banners above the campus sheet's service tiles.
 *
 * Every `autoRotateSec` the next banner slides in from the right. It cannot be
 * dragged, and it shows no page count, on purpose:
 * - A horizontal scroll view inside the sheet fought the sheet's own drag. A
 *   swipe that started on the banner moved both, or neither.
 * - A scroll view has to be told its width to page. The sheet's card inset
 *   animates as the sheet rises, so the width changed on every frame, and
 *   `LoopingPager` remounts its list on a width change: it flickered for the
 *   whole drag. Here the slot is sized by `aspectRatio`, the width only feeds a
 *   shared value on the UI thread, and nothing ever remounts.
 * - Without a count or a swipe, the next banner is a surprise, which suits a
 *   wall of student jokes.
 *
 * Tapping a banner opens it full screen, turned a quarter turn, so turning the
 * phone sideways shows the banner across its full length. A banner with an
 * action runs the action instead.
 *
 * Width follows the parent, like `ButtonGrid`, and caps at the same 480 so the
 * banner's edges line up with the tiles under it on a tablet too.
 */

import { useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SdsColors, useT, type HomeBannerImage, type SduiBannerCarousel } from '@skkuverse/shared';
import { handleSduiAction } from '../action-handler';
import { logSduiContentSelect } from '@/services/analytics';

interface Props {
  section: SduiBannerCarousel;
}

/** `ButtonGrid`'s cap, so the two share both edges. */
const MAX_WIDTH = 480;

const SLIDE_MS = 450;
const SLIDE_EASING = Easing.out(Easing.cubic);

/**
 * How far a finger may travel and still count as a tap. Past it the touch is a
 * drag, which belongs to the sheet, and the viewer does not open.
 */
const TAP_SLOP = 10;

/** Space kept clear around the turned banner in the viewer. */
const VIEWER_MARGIN = 24;

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export function BannerCarousel({ section }: Props) {
  const { items } = section;
  const n = items.length;

  // A random first banner per mount. A visit to the sheet is short next to a
  // full lap (28 banners × 6 s is almost three minutes), so starting every
  // visit on the first would give the first few nearly all the exposure.
  const [start] = useState(() => Math.floor(Math.random() * Math.max(n, 1)));
  // Pages shown so far. Only ever grows: each page is keyed by its step, so the
  // page sliding in is the same mounted view once it has arrived.
  const [step, setStep] = useState(0);
  const [viewing, setViewing] = useState<HomeBannerImage | null>(null);

  // `position` chases `step` on the UI thread; a page sits at (its step −
  // position) × width. Neither is ever reset, so no frame shows a page jump.
  const position = useSharedValue(0);
  const width = useSharedValue(0);
  const pressed = useSharedValue(0);
  const slotStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.value * 0.15 }));

  const focused = useIsFocused();
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();

  const canRotate = n > 1 && section.autoRotateSec > 0 && focused && appActive && viewing === null;

  useEffect(() => {
    if (!canRotate) return undefined;
    const target = step + 1;
    const timer = setTimeout(() => {
      if (reducedMotion) {
        position.value = target;
        setStep(target);
        return;
      }
      position.value = withTiming(target, { duration: SLIDE_MS, easing: SLIDE_EASING }, (finished) => {
        if (finished) runOnJS(setStep)(target);
      });
    }, section.autoRotateSec * 1000);
    return () => clearTimeout(timer);
  }, [canRotate, step, section.autoRotateSec, reducedMotion, position]);

  const itemAt = (s: number) => items[(start + s) % n] as HomeBannerImage;
  const current = n > 0 ? itemAt(step) : undefined;

  const onPress = () => {
    if (!current) return;
    logSduiContentSelect({ content_type: 'banner', item_id: current.id });
    if (current.action) {
      handleSduiAction(current.action);
    } else {
      setViewing(current);
    }
  };

  // A gesture-handler tap rather than a Pressable: a Pressable fires for a
  // slide that ends inside it, so a sideways swipe opened the viewer. This one
  // fails as soon as the finger travels, and leaves the drag to the sheet.
  const tap = Gesture.Tap()
    .maxDistance(TAP_SLOP)
    .onBegin(() => {
      pressed.value = 1;
    })
    .onFinalize(() => {
      pressed.value = 0;
    })
    .onEnd((_e, success) => {
      if (success) runOnJS(onPress)();
    });

  if (!current) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  // The page waiting off the right edge, so its picture has loaded before it
  // slides in, then the page on screen. Drawn in that order so the current page
  // is on top for the frame before the first layout, when both sit at x = 0.
  const steps = n > 1 ? [step + 1, step] : [step];

  return (
    <>
      <GestureDetector gesture={tap}>
        <Animated.View
          style={[styles.slot, { aspectRatio: section.aspectRatio }, slotStyle]}
          onLayout={onLayout}
          accessible
          accessibilityRole={current.action ? 'button' : 'imagebutton'}
          accessibilityLabel={current.alt}
          onAccessibilityTap={onPress}
        >
          {steps.map((s) => (
            <Page key={s} step={s} item={itemAt(s)} position={position} width={width} />
          ))}
        </Animated.View>
      </GestureDetector>

      <BannerViewer
        item={viewing}
        aspectRatio={section.aspectRatio}
        onClose={() => setViewing(null)}
      />
    </>
  );
}

function Page({
  step,
  item,
  position,
  width,
}: {
  step: number;
  item: HomeBannerImage;
  position: SharedValue<number>;
  width: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (step - position.value) * width.value }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={{ uri: item.imageUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Animated.View>
  );
}

/**
 * The banner full screen, a quarter turn clockwise. The app is portrait only,
 * so the picture turns instead of the screen: its long edge runs down the
 * screen's height, and turning the phone to the left reads it level.
 * A tap anywhere closes it.
 */
function BannerViewer({
  item,
  aspectRatio,
  onClose,
}: {
  item: HomeBannerImage | null;
  aspectRatio: number;
  onClose(): void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  // Before the turn, the banner's width becomes the screen's height, and its
  // height the screen's width. Take whichever limit binds first.
  const long = Math.min(
    height - insets.top - insets.bottom - VIEWER_MARGIN * 2,
    (width - VIEWER_MARGIN * 2) * aspectRatio,
  );
  const short = long / aspectRatio;

  return (
    <Modal
      visible={item !== null}
      animationType="fade"
      transparent
      statusBarTranslucent
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.viewer}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={item?.alt}
        accessibilityHint={t('common.close')}
      >
        {item && (
          <View
            style={{
              position: 'absolute',
              width: long,
              height: short,
              // Laid out unturned, centred; the rotation is about that centre.
              left: (width - long) / 2,
              top: (height - short) / 2,
              transform: [{ rotate: '90deg' }],
            }}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The rounded clip lives on the slot. Radius and the gap below match the tiles.
  slot: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: SdsColors.grey100,
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
});
