/**
 * Shadow — shadow presets and useShadow hook (reimplemented from TDS).
 *
 * Usage:
 *   <Shadow shadow="medium"><View>...</View></Shadow>
 *   const style = useShadow('strong');
 */
import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

// ── Shadow Config ──

export interface ShadowConfig {
  color?: string;
  /** Light mode shadow color (takes precedence over color in light mode) */
  lightColor?: string;
  /** Dark mode shadow color (takes precedence over color in dark mode) */
  darkColor?: string;
  radius: number;
  opacity: number;
  offset: { x: number; y: number };
}

export type ShadowPreset = 'weak' | 'medium' | 'strong';

const shadowPresets: Record<ShadowPreset, ShadowConfig> = {
  weak: { color: '#000000', radius: 4, opacity: 0.05, offset: { x: 0, y: 1 } },
  medium: { color: '#000000', radius: 10, opacity: 0.1, offset: { x: 0, y: 2 } },
  strong: { color: '#000000', radius: 20, opacity: 0.15, offset: { x: 0, y: 4 } },
};

// ── useShadow ──

function resolveColor(config: ShadowConfig, isDark: boolean): string {
  if (isDark && config.darkColor) return config.darkColor;
  if (!isDark && config.lightColor) return config.lightColor;
  return config.color ?? '#000000';
}

function configToStyle(config: ShadowConfig, isDark: boolean): ViewStyle {
  const color = resolveColor(config, isDark);
  if (Platform.OS === 'android') {
    return { elevation: Math.round(config.radius / 2) };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: config.offset.x, height: config.offset.y },
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
  };
}

export function useShadow(shadow: ShadowPreset | ShadowConfig): ViewStyle {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const config = typeof shadow === 'string' ? shadowPresets[shadow] : shadow;
  return configToStyle(config, isDark);
}

// ── Shadow Component ──

export interface ShadowProps {
  shadow?: ShadowPreset | ShadowConfig;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function Shadow({
  shadow = 'medium',
  children,
  style,
}: ShadowProps) {
  const shadowStyle = useShadow(shadow);

  return (
    <View style={[styles.container, shadowStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
});

export { Shadow };
