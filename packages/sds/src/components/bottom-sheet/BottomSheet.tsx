/**
 * BottomSheet — SDS-styled wrapper around @gorhom/bottom-sheet.
 *
 * Usage:
 *   <BottomSheet open={show} onClose={() => setShow(false)} title="Options">
 *     <View>...</View>
 *   </BottomSheet>
 */
import React, { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SdsColors } from '@skkuuniverse/shared';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Svg, { Path } from 'react-native-svg';

// ── Header ──

export interface BottomSheetHeaderProps {
  title?: string;
  onClose?: () => void;
  style?: StyleProp<ViewStyle>;
}

function Header({ title, onClose, style }: BottomSheetHeaderProps) {
  const adaptive = useAdaptive();

  return (
    <View style={[styles.header, style]}>
      {title != null && (
        <Txt typography="t4" fontWeight="bold" color={adaptive.grey900}>
          {title}
        </Txt>
      )}
      {onClose != null && (
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke={adaptive.grey500}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

// ── Root ──

export interface SdsBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** @default ['50%'] */
  snapPoints?: (string | number)[];
  title?: string;
  /** @default false */
  enableDynamicSizing?: boolean;
  style?: StyleProp<ViewStyle>;
}

function SdsBottomSheet({
  open,
  onClose,
  children,
  snapPoints = ['50%'],
  title,
  enableDynamicSizing = false,
  style,
}: SdsBottomSheetProps) {
  const sheetRef = useRef<GorhomBottomSheet>(null);

  useEffect(() => {
    if (open) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      ref={sheetRef}
      index={open ? 0 : -1}
      snapPoints={enableDynamicSizing ? undefined : snapPoints}
      enableDynamicSizing={enableDynamicSizing}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
      style={style}
    >
      {title != null && <Header title={title} onClose={onClose} />}
      <BottomSheetView style={styles.content}>
        {children}
      </BottomSheetView>
    </GorhomBottomSheet>
  );
}

// ── Compound Export ──

export const BottomSheet = Object.assign(SdsBottomSheet, {
  Header,
});

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: SdsColors.grey300,
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  background: {
    backgroundColor: SdsColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
