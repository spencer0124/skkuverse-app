/**
 * Gradient — Linear and Radial gradient components (reimplemented from TDS .d.ts).
 *
 * Usage:
 *   <Gradient.Linear colors={['#ff0000', '#0000ff']} style={{ height: 200 }} />
 *   <Gradient.Radial colors={['#ff0000', '#0000ff']} style={{ height: 200 }} />
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

// ── Easing ──

type GradientEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

const easingFns: Record<GradientEasing, (t: number) => number> = {
  'linear': (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
};

/** Lerp between two hex/rgba colors (simple channel-wise) */
function lerpColor(a: string, b: string, t: number): string {
  const parse = (c: string) => {
    const rgba = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] != null ? +rgba[4] : 1 };
    const hex = c.replace('#', '');
    const h = hex.length === 3 ? hex.split('').map(x => x + x).join('') : hex;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  };
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  const al = ca.a + (cb.a - ca.a) * t;
  return al < 1 ? `rgba(${r}, ${g}, ${bl}, ${al.toFixed(2)})` : `rgb(${r}, ${g}, ${bl})`;
}

/** Expand color stops with easing interpolation */
function applyEasing(
  colors: string[],
  positions: number[] | undefined,
  easing: GradientEasing | undefined,
  colorStopCount: number | undefined,
): { color: string; offset: number }[] {
  if (!easing || easing === 'linear') {
    return colors.map((color, i) => ({
      color,
      offset: positions?.[i] ?? (colors.length > 1 ? i / (colors.length - 1) : 0),
    }));
  }

  const fn = easingFns[easing];
  const steps = colorStopCount ?? 10;
  const result: { color: string; offset: number }[] = [];

  for (let seg = 0; seg < colors.length - 1; seg++) {
    const startPos = positions?.[seg] ?? seg / (colors.length - 1);
    const endPos = positions?.[seg + 1] ?? (seg + 1) / (colors.length - 1);
    for (let s = 0; s <= steps; s++) {
      if (seg > 0 && s === 0) continue; // avoid duplicate
      const t = s / steps;
      const eased = fn(t);
      result.push({
        color: lerpColor(colors[seg], colors[seg + 1], eased),
        offset: startPos + (endPos - startPos) * t,
      });
    }
  }
  return result;
}

// ── Helpers ──

function degreeToPoints(deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  const x1 = 0.5 - 0.5 * Math.cos(rad);
  const y1 = 0.5 - 0.5 * Math.sin(rad);
  const x2 = 0.5 + 0.5 * Math.cos(rad);
  const y2 = 0.5 + 0.5 * Math.sin(rad);
  return { x1: `${x1 * 100}%`, y1: `${y1 * 100}%`, x2: `${x2 * 100}%`, y2: `${y2 * 100}%` };
}

function parseDegree(degree: string): number {
  const match = degree.match(/^(-?\d+(?:\.\d+)?)deg$/);
  return match ? parseFloat(match[1]) : 180;
}

// ── LinearGradient ──

export interface LinearGradientProps {
  colors: string[];
  /** @default '180deg' */
  degree?: string | number;
  /** Stop positions (0-1), defaults to evenly spaced */
  positions?: number[];
  easing?: GradientEasing;
  colorStopCount?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

function LinearGradientComponent({
  colors,
  degree = '180deg',
  positions,
  easing,
  colorStopCount,
  style,
  children,
}: LinearGradientProps) {
  const deg = typeof degree === 'number' ? degree : parseDegree(degree);
  const points = degreeToPoints(deg);

  const stops = applyEasing(colors, positions, easing, colorStopCount);

  return (
    <View style={[styles.container, style]}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="lg" x1={points.x1} y1={points.y1} x2={points.x2} y2={points.y2}>
            {stops.map((stop, i) => (
              <Stop key={i} offset={stop.offset} stopColor={stop.color} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lg)" />
      </Svg>
      {children}
    </View>
  );
}

// ── RadialGradient ──

export interface RadialGradientProps {
  colors: string[];
  /** Stop positions (0-1) */
  positions?: number[];
  easing?: GradientEasing;
  colorStopCount?: number;
  /** Center X (0-1), @default 0.5 */
  cx?: number;
  /** Center Y (0-1), @default 0.5 */
  cy?: number;
  /** Radius (0-1), @default 0.5 */
  r?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

function RadialGradientComponent({
  colors,
  positions,
  easing,
  colorStopCount,
  cx = 0.5,
  cy = 0.5,
  r = 0.5,
  style,
  children,
}: RadialGradientProps) {
  const stops = applyEasing(colors, positions, easing, colorStopCount);

  return (
    <View style={[styles.container, style]}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgRadialGradient
            id="rg"
            cx={`${cx * 100}%`}
            cy={`${cy * 100}%`}
            r={`${r * 100}%`}
          >
            {stops.map((stop, i) => (
              <Stop key={i} offset={stop.offset} stopColor={stop.color} />
            ))}
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#rg)" />
      </Svg>
      {children}
    </View>
  );
}

// ── Compound Export ──

export const Gradient = {
  Linear: LinearGradientComponent,
  Radial: RadialGradientComponent,
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
