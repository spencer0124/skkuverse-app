/**
 * Dialog — modal dialogs (Alert + Confirm).
 *
 * Standalone component using `open` prop (NOT OverlayProvider imperative API).
 *
 * Usage:
 *   <Dialog.Alert open={show} title="알림" description="완료되었습니다" onClose={() => setShow(false)} />
 *   <Dialog.Confirm
 *     open={show}
 *     title="삭제"
 *     description="정말 삭제할까요?"
 *     leftButton={<Button style="weak" type="dark" onPress={cancel}>취소</Button>}
 *     rightButton={<Button type="danger" onPress={confirm}>삭제</Button>}
 *     onClose={() => setShow(false)}
 *   />
 */
import React, { useCallback, useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuverse/shared';
import { springConfig } from '../../foundation/easings';
import { Txt } from '../txt';
import { Button } from '../button';

// ── AlertDialog ──

export interface AlertDialogProps {
  open: boolean;
  title?: ReactNode;
  description?: string;
  content?: ReactNode;
  /** @default '확인' */
  buttonText?: string;
  onButtonPress?: () => void;
  onClose: () => void;
  onExited?: () => void;
  onEntered?: () => void;
  /** @default true */
  closeOnDimmerClick?: boolean;
}

function AlertDialog({
  open,
  title,
  description,
  content,
  buttonText = '확인',
  onButtonPress,
  onClose,
  onExited,
  onEntered,
  closeOnDimmerClick = true,
}: AlertDialogProps) {
  const dimmer = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const mounted = useSharedValue(false);

  useEffect(() => {
    if (open) {
      mounted.value = true;
      dimmer.value = withTiming(1, { duration: 200 });
      cardOpacity.value = withTiming(1, { duration: 200 });
      cardScale.value = withSpring(1, springConfig('quick'), (finished) => {
        if (finished && onEntered) runOnJS(onEntered)();
      });
    } else if (mounted.value) {
      dimmer.value = withTiming(0, { duration: 200 });
      cardScale.value = withTiming(0.9, { duration: 200 });
      cardOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          mounted.value = false;
          if (onExited) runOnJS(onExited)();
        }
      });
    }
  }, [open, dimmer, cardScale, cardOpacity, mounted, onExited, onEntered]);

  const dimmerStyle = useAnimatedStyle(() => ({
    opacity: dimmer.value,
    display: mounted.value ? 'flex' : 'none',
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const handleButton = useCallback(() => {
    onButtonPress?.();
    onClose();
  }, [onButtonPress, onClose]);

  const handleDimmerPress = useCallback(() => {
    if (closeOnDimmerClick) onClose();
  }, [closeOnDimmerClick, onClose]);

  const renderTitle = () => {
    if (title == null) return null;
    if (typeof title === 'string') {
      return (
        <Txt typography="t4" fontWeight="bold" style={styles.title}>
          {title}
        </Txt>
      );
    }
    return <View style={styles.title}>{title}</View>;
  };

  return (
    <Animated.View style={[styles.overlay, dimmerStyle]} pointerEvents={open ? 'auto' : 'none'}>
      <Pressable style={styles.dimmer} onPress={handleDimmerPress} />
      <Animated.View style={[styles.card, cardStyle]}>
        {renderTitle()}
        {description != null && (
          <Txt typography="t6" color={SdsColors.grey600} style={styles.description}>
            {description}
          </Txt>
        )}
        {content}
        <View style={styles.buttonRow}>
          <Button size="large" display="block" onPress={handleButton}>
            {buttonText}
          </Button>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── ConfirmDialog ──

export interface ConfirmDialogProps {
  open: boolean;
  title?: ReactNode;
  description?: string;
  content?: ReactNode;
  leftButton: ReactNode;
  rightButton: ReactNode;
  onClose: () => void;
  onExited?: () => void;
  onEntered?: () => void;
  /** @default true */
  closeOnDimmerClick?: boolean;
}

function ConfirmDialog({
  open,
  title,
  description,
  content,
  leftButton,
  rightButton,
  onClose,
  onExited,
  onEntered,
  closeOnDimmerClick = true,
}: ConfirmDialogProps) {
  const dimmer = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const mounted = useSharedValue(false);

  useEffect(() => {
    if (open) {
      mounted.value = true;
      dimmer.value = withTiming(1, { duration: 200 });
      cardOpacity.value = withTiming(1, { duration: 200 });
      cardScale.value = withSpring(1, springConfig('quick'), (finished) => {
        if (finished && onEntered) runOnJS(onEntered)();
      });
    } else if (mounted.value) {
      dimmer.value = withTiming(0, { duration: 200 });
      cardScale.value = withTiming(0.9, { duration: 200 });
      cardOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          mounted.value = false;
          if (onExited) runOnJS(onExited)();
        }
      });
    }
  }, [open, dimmer, cardScale, cardOpacity, mounted, onExited, onEntered]);

  const dimmerStyle = useAnimatedStyle(() => ({
    opacity: dimmer.value,
    display: mounted.value ? 'flex' : 'none',
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const handleDimmerPress = useCallback(() => {
    if (closeOnDimmerClick) onClose();
  }, [closeOnDimmerClick, onClose]);

  const renderTitle = () => {
    if (title == null) return null;
    if (typeof title === 'string') {
      return (
        <Txt typography="t4" fontWeight="bold" style={styles.title}>
          {title}
        </Txt>
      );
    }
    return <View style={styles.title}>{title}</View>;
  };

  return (
    <Animated.View style={[styles.overlay, dimmerStyle]} pointerEvents={open ? 'auto' : 'none'}>
      <Pressable style={styles.dimmer} onPress={handleDimmerPress} />
      <Animated.View style={[styles.card, cardStyle]}>
        {renderTitle()}
        {description != null && (
          <Txt typography="t6" color={SdsColors.grey600} style={styles.description}>
            {description}
          </Txt>
        )}
        {content}
        <View style={styles.confirmButtonRow}>
          <View style={styles.confirmButton}>{leftButton}</View>
          <View style={styles.confirmButton}>{rightButton}</View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ── Compound export ──

export const Dialog = {
  Alert: AlertDialog,
  Confirm: ConfirmDialog,
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  dimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    backgroundColor: SdsColors.background,
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    width: '85%',
    maxWidth: 320,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    marginTop: 8,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  confirmButton: {
    flex: 1,
  },
});
