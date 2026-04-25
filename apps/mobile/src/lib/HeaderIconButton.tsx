import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet } from 'react-native';

/**
 * Standard tap target for native Stack `headerRight` icons.
 *
 * Why explicit dimensions:
 *   react-native-screens hosts `headerRight` inside iOS UIBarButtonItem(customView).
 *   Without a fixed width, iOS auto-layout stretches the child to the available
 *   header area, distorting SVG icons. 44×44 is also iOS HIG's minimum tap target.
 */
interface Props extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
}

export function HeaderIconButton({ children, ...rest }: Props) {
  return (
    <Pressable hitSlop={8} {...rest} style={styles.root}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
