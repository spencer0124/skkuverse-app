/**
 * SDS Color Foundation — bridges SdsColors to the theme system.
 *
 * Provides:
 * - Adaptive color maps for light/dark mode
 * - Semantic color seeds for the theme provider
 */
import { SdsColors } from '@skkuverse/shared';

export type ColorPreference = 'light' | 'dark';

/**
 * Full adaptive color map — resolves to actual hex values based on preference.
 * Currently light-only; dark theme values will be added later.
 */
export function getAdaptiveColors(preference: ColorPreference) {
  // TODO: Add dark theme when needed
  if (preference === 'dark') {
    return {
      ...SdsColors,
      grey900: '#FFFFFF',
      grey800: '#ECECEC',
      grey700: '#B0B8C1',
      grey600: '#8B95A1',
      grey500: '#6B7684',
      grey400: '#4E5968',
      grey300: '#333D4B',
      grey200: '#2B2E33',
      grey100: '#1E2025',
      grey50: '#17171C',
      background: '#17171C',
      greyBackground: '#1E2025',
      layeredBackground: '#1E2025',
      floatedBackground: '#2B2E33',
    };
  }

  return { ...SdsColors };
}

/** Default seed colors for the theme system */
export const colorSeeds = {
  primary: SdsColors.blue500,
  danger: SdsColors.red500,
  success: SdsColors.green500,
  warning: SdsColors.orange500,
} as const;

export type ColorSeeds = typeof colorSeeds;
