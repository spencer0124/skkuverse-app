/**
 * Clips a crossfading modal's content to the card the user can see.
 *
 * Gorhom lays a sheet's body out as tall as its top detent wherever the sheet
 * sits, and moves it with a translate — so at the collapsed detent the body
 * runs past the floating card's bottom edge and anything laid out there draws
 * over the map (`docs/explanation/bottom-sheet-system.md`, "A crossfading modal
 * has to pay for its own gap"). Padding the scroll content only moved the LAST
 * row clear of that band. The place sheet fills the collapsed card to its edge
 * on purpose, so there is always content in the band, and it has to be cut.
 *
 * The cut follows the card exactly: the same height and bottom corners
 * `ExpandableSheetBackground` computes, from the same `sheetChromeAt`, less the
 * handle that sits above the content. Only this wrapper's height changes per
 * frame; what it holds is laid out once at the body's full height, so a drag
 * re-lays out one view and nothing beneath it.
 */

import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomCornerRadius, sheetChromeAt } from '@skkuverse/sds';

/** `SheetHandle`'s height (`packages/sds/src/components/sheet/SheetHandle.tsx`). */
export const SHEET_HANDLE_HEIGHT = 22;

interface SheetCardClipProps {
  animatedIndex: SharedValue<number>;
  animatedPosition: SharedValue<number>;
  /** The sheet's `snapPoints.length - 1`. */
  lastIndex: number;
  /** The floating card's bottom gap — the `bottomGap` handed to `Sheet`. */
  bottomGap: number;
  children: React.ReactNode;
}

export function SheetCardClip({
  animatedIndex,
  animatedPosition,
  lastIndex,
  bottomGap,
  children,
}: SheetCardClipProps) {
  // A modal's container is the window (`Sheet` resolves its detents against the
  // same number), and its top detent stops under the top safe area.
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bodyHeight = Math.max(windowHeight - insets.top - SHEET_HANDLE_HEIGHT, 0);

  const clip = useAnimatedStyle(() => {
    const { progress, radius } = sheetChromeAt(animatedIndex.get(), lastIndex);
    const gap = bottomGap * (1 - progress);
    const bottomRadius = bottomCornerRadius(radius, gap);
    return {
      height: Math.max(windowHeight - gap - animatedPosition.get() - SHEET_HANDLE_HEIGHT, 0),
      borderBottomLeftRadius: bottomRadius,
      borderBottomRightRadius: bottomRadius,
    };
  }, [windowHeight, bottomGap, lastIndex]);

  return (
    <Animated.View style={[styles.clip, clip]}>
      <View style={{ height: bodyHeight }}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
