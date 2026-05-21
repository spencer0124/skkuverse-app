/**
 * FixedBottomCTA — bottom CTA with keyboard avoiding behavior.
 *
 * Usage (static children):
 *   <FixedBottomCTA>
 *     <Button display="block">Submit</Button>
 *   </FixedBottomCTA>
 *
 * Usage (render-prop, react to keyboard state):
 *   <FixedBottomCTA flushOnKeyboard>
 *     {({ keyboardVisible }) => (
 *       <Button display={keyboardVisible ? 'full' : 'block'}>Submit</Button>
 *     )}
 *   </FixedBottomCTA>
 */
import React, { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface FixedBottomCTAContext {
  keyboardVisible: boolean;
}

export interface FixedBottomCTAProps {
  children: ReactNode | ((ctx: FixedBottomCTAContext) => ReactNode);
  /** @default true */
  enableKeyboardAvoiding?: boolean;
  /**
   * Drop horizontal/top padding when keyboard is visible so the child can render
   * as a full-width flush rectangle hugging the keyboard.
   * @default false
   */
  flushOnKeyboard?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function FixedBottomCTA({
  children,
  enableKeyboardAvoiding = true,
  flushOnKeyboard = false,
  style,
}: FixedBottomCTAProps) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const flush = flushOnKeyboard && keyboardVisible;
  const paddingBottom = keyboardVisible ? 0 : Math.max(insets.bottom, 16);
  const paddingHorizontal = flush ? 0 : 20;
  const paddingTop = flush ? 0 : 12;

  const renderedChildren =
    typeof children === 'function' ? children({ keyboardVisible }) : children;

  const content = (
    <View
      style={[
        styles.container,
        { paddingBottom, paddingHorizontal, paddingTop },
        style,
      ]}
    >
      {renderedChildren}
    </View>
  );

  if (!enableKeyboardAvoiding) return content;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
});

export { FixedBottomCTA };
