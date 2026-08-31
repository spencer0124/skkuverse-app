/**
 * The app's one bottom sheet.
 *
 * A call site declares WHAT it wants — where the sheet sits, whether it can be
 * moved, whether it is glass — and this picks the mechanism. Before it existed,
 * eleven sheets picked their own, four different ways, and no two agreed on a
 * height.
 *
 * ## The surface table
 *
 * `surface` and `position` together decide how the card is drawn. Only the last
 * row costs anything per frame.
 *
 * | surface | position   | top detent | drawn by                        |
 * |---------|------------|------------|---------------------------------|
 * | solid   | any        | any        | `AttachedSheetBackground`       |
 * | glass   | stuck      | ≠ large    | `StuckSheetBackground`, detached|
 * | glass   | stuck      | large      | `AttachedSheetBackground`       |
 * | glass   | expandable | ≠ large    | `StuckSheetBackground`, detached|
 * | glass   | expandable | large      | `ExpandableSheetBackground`     |
 *
 * The rule underneath it is one sentence: **a card is glass while it floats and
 * opaque once it attaches**, and `large` is the detent that attaches. Whether
 * the sheet can be dragged decides only whether that change is animated or
 * static — it is not what decides the surface.
 *
 * `detached` is gorhom's own floating-card mode: it moves the inset onto the
 * hosting container and switches it to `overflow: 'visible'`, so the sheet
 * body's box IS the visible card and the background has nothing to measure.
 * It is a static mode, which is exactly why a sheet that starts low and
 * attaches at the top cannot use it and has to compute its card instead.
 *
 * ## Two gestures, not one
 *
 * "Can it move between detents" and "can it be swiped away" are separate
 * questions, and gorhom answers both with the same pair of panning props. A
 * stuck sheet has nowhere to travel and still closes on a downward swipe, which
 * is what nearly every modal in the app does. Only a sheet that is both stuck
 * AND not dismissible — the map's filter sheet, which closes by its X or its
 * backdrop — turns the gestures off and drops its grabber.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetSectionList,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { SdsColors } from '@skkuverse/shared';
import { GLASS_AVAILABLE } from '../glass';
import { resolveSheetPosition, type SheetPosition } from './detents';
import { sheetChromeAt, SHEET_FLOAT_INSET } from './chrome';
import { AttachedSheetBackground } from './AttachedSheetBackground';
import { StuckSheetBackground } from './StuckSheetBackground';
import { ExpandableSheetBackground } from './ExpandableSheetBackground';
import { SheetHandle } from './SheetHandle';
import { SheetCloseButton } from './SheetCloseButton';
import { SheetHeader } from './SheetHeader';

/**
 * A sheet's imperative handle.
 *
 * `present` and `dismiss` belong to a modal and are absent on an inline sheet,
 * which is mounted for the life of its screen. They are optional rather than
 * asserted so that calling one on the wrong kind is a type error at the call
 * site instead of a crash at runtime.
 */
export interface SheetRef {
  snapToIndex: (index: number) => void;
  expand: () => void;
  collapse: () => void;
  close: () => void;
  forceClose: () => void;
  /** Modal sheets only. */
  present?: () => void;
  /** Modal sheets only. */
  dismiss?: () => void;
}

export interface SheetProps {
  /**
   * `modal` portals out to `BottomSheetModalProvider` and is presented
   * imperatively; `inline` is mounted for the life of the screen that renders
   * it. @default 'modal'
   */
  presentation?: 'modal' | 'inline';
  /** Where the sheet sits, and whether it can be moved. */
  position: SheetPosition;
  /**
   * `glass` asks for the floating Liquid Glass card. Ignored on any platform
   * without it, and at the `large` detent, where a card does not float.
   * @default 'solid'
   */
  surface?: 'solid' | 'glass';
  /**
   * Whether a downward swipe closes the sheet.
   * @default true for a modal, false for an inline sheet
   */
  dismissible?: boolean;
  /**
   * Whether a scrim is drawn behind the sheet. Its darkness follows `surface`:
   * a glass card gets a much lighter one, because glass samples what is behind
   * it and a full scrim turns the card into a flat grey panel.
   * @default false
   */
  backdrop?: boolean;
  /**
   * The container's height, for an INLINE sheet only.
   *
   * Percentage detents resolve against the sheet's container, and an inline
   * sheet's container is the host screen's own box rather than the window, so
   * the host is the only one who can measure it. A modal is portalled to the
   * window and needs nothing.
   */
  containerHeight?: number;
  /**
   * The card's bottom gap while it floats, in points. Glass only.
   *
   * Defaults to the same side gap the card uses, which is right for an inline
   * sheet whose container already stops above the tab bar. A modal's container
   * is the whole window, so a modal that has to line up with an inline card on
   * the same screen must restate that card's bottom edge here.
   */
  bottomGap?: number;
  /** Pinned above the content, outside the scrollable. */
  footer?: ReactNode;
  /**
   * @default 'adjustPan' — gorhom's own default. `adjustResize` is for a sheet
   * with a text input, which wants the content to shrink rather than slide.
   */
  androidKeyboardInputMode?: 'adjustPan' | 'adjustResize';
  /**
   * What happens to a sheet that is already up. Modal sheets only.
   *
   * gorhom's own default, restated rather than changed: `switch` minimises the
   * sheet underneath and resurfaces it on close, which is right for a sheet
   * that genuinely stacks and wrong for one that replaces what it opened over.
   * The map's sheets pass `replace` for exactly that reason.
   * @default 'switch'
   */
  stackBehavior?: 'push' | 'replace' | 'switch';
  /**
   * Declarative alternative to presenting through the ref. Modal sheets only.
   *
   * Pick one or the other. Driving the same sheet from a boolean AND from
   * imperative calls gives it two sources of truth, and they disagree the first
   * time the user swipes it away. `open` is the right choice when a screen
   * already holds the state for other reasons; a ref is right when the sheet is
   * opened from somewhere that has no state to spare, which is most of them.
   */
  open?: boolean;
  /** Written by gorhom. Supply one to drive something outside the sheet. */
  animatedIndex?: SharedValue<number>;
  /** Written by gorhom. Supply one to drive something outside the sheet. */
  animatedPosition?: SharedValue<number>;
  onChange?: (index: number) => void;
  onClose?: () => void;
  /** Modal sheets only. Fires for a swipe-away and a programmatic dismiss alike. */
  onDismiss?: () => void;
  /** Merged onto the sheet body, after the card's own inset. */
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

function SheetRoot(
  {
    presentation = 'modal',
    position,
    surface = 'solid',
    dismissible,
    backdrop = false,
    containerHeight,
    bottomGap = SHEET_FLOAT_INSET,
    footer,
    androidKeyboardInputMode = 'adjustPan',
    stackBehavior = 'switch',
    open,
    animatedIndex,
    animatedPosition,
    onChange,
    onClose,
    onDismiss,
    style,
    children,
  }: SheetProps,
  ref: React.Ref<SheetRef>,
) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  /**
   * The ref gorhom itself is handed, and the one the caller gets, are two
   * different things on purpose.
   *
   * `BottomSheetModal.present()` registers the sheet in the provider's queue by
   * storing **the forwarded ref itself** — `mountSheet(key, ref, stackBehavior)`
   * — and the provider later closes it with `queued.ref?.current?.dismiss()`.
   * So gorhom must receive a ref OBJECT. Hand it a callback ref (what merging
   * two refs naturally produces) and `.current` is `undefined` on a function,
   * the optional chain short-circuits, and every `dismiss()` in the app becomes
   * a silent no-op — the sheet renders, its close button does nothing, and
   * nothing throws. The same applies to `restore()` on a stacked sheet.
   *
   * So `ownRef` goes to gorhom, and the caller's ref gets an explicit handle
   * that delegates to it.
   */
  const ownRef = useRef<SheetRef | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      snapToIndex: (i: number) => ownRef.current?.snapToIndex(i),
      expand: () => ownRef.current?.expand(),
      collapse: () => ownRef.current?.collapse(),
      close: () => ownRef.current?.close(),
      forceClose: () => ownRef.current?.forceClose(),
      present: () => ownRef.current?.present?.(),
      dismiss: () => ownRef.current?.dismiss?.(),
    }),
    [],
  );

  useEffect(() => {
    if (open == null) return;
    if (open) ownRef.current?.present?.();
    else ownRef.current?.dismiss?.();
  }, [open]);

  // gorhom writes into whichever shared values it is handed. Owning a pair when
  // the caller supplies none keeps the background and the card's inset reading
  // the same source either way.
  const ownIndex = useSharedValue(-1);
  const ownPosition = useSharedValue(0);
  const index = animatedIndex ?? ownIndex;
  const sheetTop = animatedPosition ?? ownPosition;

  const box = containerHeight ?? windowHeight;
  const largeHeight = box > 0 ? box - insets.top : null;
  const resolved = useMemo(
    () => resolveSheetPosition(position, largeHeight),
    [position, largeHeight],
  );

  const isModal = presentation === 'modal';
  const canDismiss = dismissible ?? isModal;
  // A stuck, undismissable sheet is the one case with nothing to pan for.
  const panning = resolved.movesBetweenDetents || canDismiss;

  const glass = surface === 'glass' && GLASS_AVAILABLE;
  /** Glass that stays one shape: gorhom's `detached` draws the card for free. */
  const floatsStatically = glass && !resolved.attachesAtTop;
  /**
   * Glass that has to travel from a floating card to an attached surface.
   *
   * Both halves are load bearing. A sheet STUCK at `large` reaches the attached
   * state and never leaves it, so there is nothing to interpolate — it takes the
   * plain background rather than paying for a `GlassView` that is covered by an
   * opaque fill at every frame it will ever draw.
   */
  const travels = glass && resolved.attachesAtTop && resolved.movesBetweenDetents;

  const renderBackground = useCallback(
    ({ style: bgStyle, pointerEvents }: BottomSheetBackgroundProps) => {
      if (travels) {
        return (
          <ExpandableSheetBackground
            style={bgStyle}
            pointerEvents={pointerEvents}
            animatedIndex={index}
            animatedPosition={sheetTop}
            lastIndex={resolved.lastIndex}
            floatBottomGap={bottomGap}
          />
        );
      }
      if (floatsStatically) {
        return (
          <StuckSheetBackground
            style={bgStyle}
            pointerEvents={pointerEvents}
            bottomGap={bottomGap}
          />
        );
      }
      return <AttachedSheetBackground style={bgStyle} pointerEvents={pointerEvents} />;
    },
    [travels, floatsStatically, index, sheetTop, resolved.lastIndex, bottomGap],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        // The token carries the alpha, so gorhom's `opacity` is purely the
        // animation target: 1 means "ramp all the way to the token's own value".
        opacity={1}
        style={[props.style, glass ? styles.scrimGlass : styles.scrim]}
      />
    ),
    [glass],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        {footer}
      </BottomSheetFooter>
    ),
    [footer],
  );

  // The card's side inset rides on the sheet BODY rather than on the
  // background, because it has to move the background, the handle and the
  // content as one unit. Insetting the background alone leaves the strips
  // either side of the card looking like content behind the sheet while still
  // belonging to its scroll view, so a drag there moves the sheet instead of
  // whatever is underneath. A margin is legal here where `left`/`right` would
  // not be: gorhom composes its own absolute positioning after this style, so
  // its rules win any collision, and a margin on a box pinned to both edges
  // simply narrows it.
  const travellingInset = useAnimatedStyle(
    () => ({ marginHorizontal: sheetChromeAt(index.get(), resolved.lastIndex).sideInset }),
    [resolved.lastIndex],
  );
  const bodyStyle = travels
    ? [travellingInset, style]
    : floatsStatically
      ? [styles.floatingCard, style]
      : style;

  const shared = {
    snapPoints: resolved.snapPoints,
    enableDynamicSizing: resolved.enableDynamicSizing,
    animatedIndex: index,
    animatedPosition: sheetTop,
    handleComponent: panning ? SheetHandle : null,
    backgroundComponent: renderBackground,
    backdropComponent: backdrop ? renderBackdrop : undefined,
    footerComponent: footer != null ? renderFooter : undefined,
    enableHandlePanningGesture: panning,
    enableContentPanningGesture: panning,
    // Spelled out rather than inherited. gorhom's inline sheet defaults this to
    // false and its modal overrides it to true, so leaving it alone is how two
    // sheets end up behaving differently for no stated reason.
    enablePanDownToClose: canDismiss,
    // `detached` is what turns the sheet body's box into the visible card. Both
    // halves have to move together: the background component drawn above
    // assumes the box it is handed IS the card.
    detached: floatsStatically,
    bottomInset: floatsStatically ? bottomGap : 0,
    android_keyboardInputMode: androidKeyboardInputMode,
    onChange,
    onClose,
    style: bodyStyle,
    children,
  } as const;

  if (isModal) {
    return (
      <BottomSheetModal
        ref={ownRef as React.RefObject<BottomSheetModal>}
        {...shared}
        index={resolved.initialIndex}
        stackBehavior={stackBehavior}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <GorhomBottomSheet
      ref={ownRef as React.RefObject<GorhomBottomSheet>}
      {...shared}
      index={resolved.initialIndex}
    />
  );
}

const SheetForwarded = forwardRef<SheetRef, SheetProps>(SheetRoot);
SheetForwarded.displayName = 'Sheet';

/**
 * The three scrollables are re-exported rather than wrapped: a sheet's content
 * has to register with the draggable context itself, and only one of them may
 * be mounted at a time — a gorhom scrollable cannot nest inside another.
 */
export const Sheet = Object.assign(SheetForwarded, {
  View: BottomSheetView,
  ScrollView: BottomSheetScrollView,
  FlatList: BottomSheetFlatList,
  SectionList: BottomSheetSectionList,
  Header: SheetHeader,
  CloseButton: SheetCloseButton,
  Handle: SheetHandle,
});

const styles = StyleSheet.create({
  /** The card's side gap, held constant because this card never attaches. */
  floatingCard: {
    marginHorizontal: SHEET_FLOAT_INSET,
  },
  scrim: {
    backgroundColor: SdsColors.scrim,
  },
  scrimGlass: {
    backgroundColor: SdsColors.scrimGlass,
  },
});
