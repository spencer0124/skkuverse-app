/**
 * SDS Color Tokens — based on TDS (Toss Design System) official values.
 *
 * Use these tokens instead of hardcoded hex values in all styling.
 * Flutter source: lib/design/sds_colors.dart
 */
export const SdsColors = {
  // ── Grey Scale ──
  grey50: '#F9FAFB',
  grey100: '#F2F4F6',
  grey200: '#E5E8EB',
  grey300: '#D1D6DB',
  grey400: '#B0B8C1',
  grey500: '#8B95A1',
  grey600: '#6B7684',
  grey700: '#4E5968',
  grey800: '#333D4B',
  grey900: '#191F28',

  // ── Grey Opacity (overlay/dim) ──
  greyOpacity50: 'rgba(0, 23, 51, 0.02)',
  greyOpacity200: 'rgba(0, 27, 55, 0.10)',
  greyOpacity500: 'rgba(3, 24, 50, 0.46)',
  greyOpacity800: 'rgba(0, 12, 30, 0.80)',
  greyOpacity900: 'rgba(2, 9, 19, 0.91)',

  // ── Blue (action, link, accent) ──
  blue50: '#E8F3FF',
  blue200: '#90C2FF',
  blue400: '#4593FC',
  blue500: '#3182F6',
  blue600: '#2272EB',
  blue700: '#1B64DA',

  // ── Red (error, danger) ──
  red50: '#FFEEEE',
  red500: '#F04452',

  // ── Green (success, active) ──
  green50: '#F0FAF6',
  green500: '#03B26C',

  // ── Orange (caution) ──
  orange50: '#FFF3E0',
  orange500: '#FE9800',

  // ── Yellow (warning) ──
  yellow50: '#FFF9E7',
  yellow400: '#FFD158',
  yellow500: '#FFC342',
  yellow800: '#EE8F11',
  yellow900: '#DD7D02',

  // ── Teal ──
  teal50: '#EDF8F8',
  teal500: '#18A5A5',

  // ── Purple ──
  purple500: '#A234C7',

  // ── Utility ──
  highlight: '#FFE08C',

  // ── Background ──
  background: '#FFFFFF',
  greyBackground: '#F2F4F6', // = grey100
  layeredBackground: '#FFFFFF',
  floatedBackground: '#FFFFFF',

  // ── Brand ──
  brand: '#1A7F4B',
  brandLight: '#E8F5EE',
} as const;
