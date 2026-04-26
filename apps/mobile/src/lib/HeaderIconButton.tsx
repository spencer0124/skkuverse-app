import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const GLASS_AVAILABLE = isLiquidGlassAvailable();

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
 *
 * `glass` prop: opt-in for callers that render OUTSIDE a native Stack header
 *   (e.g. fully custom React headers like NoticesHeader). On iOS 26+ wraps the
 *   pressable in `expo-glass-effect`'s `GlassView` to produce the same per-button
 *   Liquid Glass capsule as `unstable_headerRightItems` with `sharesBackground:
 *   false`. Native-bar callers (home/bus/map) leave it false to avoid
 *   double-glass — the system bar already provides the intrinsic capsule.
 */
interface Props extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  glass?: boolean;
}

export function HeaderIconButton({ children, glass = false, ...rest }: Props) {
  if (glass && GLASS_AVAILABLE) {
    return (
      <View style={[styles.glassOuter, styles.glassShadow]}>
        <View style={styles.glassFillBase}>
          <GlassView style={styles.glassSurface} glassEffectStyle="regular" isInteractive>
            <Pressable hitSlop={10} {...rest} style={styles.glassPressable}>
              {children}
            </Pressable>
          </GlassView>
        </View>
      </View>
    );
  }
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
  // Glass mode capsule is intentionally LARGER than the plain-mode 36×36
  // (which is locked to iOS UIBarButton intrinsic). 44×44 + br 22 matches
  // the measured visual size of home tab's native `unstable_headerRightItems`
  // capsules (~47pt observed via Dynamic Island as ruler) within ±3pt — close
  // enough that icon-to-capsule ratio (18/44 = 0.41) hits the iOS HIG sweet
  // spot of 0.40-0.45 instead of looking cramped at 0.50.
  glassOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  // Visible capsule body — iOS native bar button (`unstable_headerRightItems`)
  // sits inside a system-blurred bar (`headerBlurEffect`), which gives the
  // capsule something to refract; the system also paints a `secondarySystemFill`
  // tone so the capsule reads as a distinct pill on plain backgrounds. Notices
  // header bg is solid white, so we replicate that fill ourselves underneath
  // the GlassView. Without this base, the glass material is nearly invisible
  // because there's no varied content beneath it to refract.
  glassFillBase: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(120, 120, 128, 0.16)',
  },
  glassSurface: {
    flex: 1,
  },
  glassPressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Float shadow tuned between SdsShadows.card (too subtle) and elevated
  // (too strong against the capsule's specular highlight). Mirrors the
  // RefreshFab / AccountSettingsScreen Liquid Glass shadow recipe.
  glassShadow: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
