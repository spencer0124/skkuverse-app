import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet } from 'react-native';

/**
 * Standard tap target for native Stack `headerRight` icons.
 *
 * Why 36×36 + hitSlop:
 *   react-native-screens hosts `headerRight` inside iOS UIBarButtonItem(customView).
 *   Without a fixed width, iOS auto-layout stretches the child and distorts SVGs.
 *   On iOS 26 the UIBarButton parent has an intrinsic Liquid Glass capsule of
 *   36pt — when the child differs from 36 the trailing constraint pulls it
 *   off-center (see software-mansion/react-native-screens#2990 view-hierarchy
 *   investigation by @intergalacticspacehighway). 36×36 lets the system capsule
 *   wrap the child cleanly. hitSlop 10 keeps the effective tap area at 56×56,
 *   well above HIG's 44×44 minimum.
 */
interface Props extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
}

export function HeaderIconButton({ children, ...rest }: Props) {
  return (
    <Pressable hitSlop={10} {...rest} style={styles.root}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
