/**
 * SDSProvider — root provider for all SDS components.
 *
 * Replaces TDSProvider. No granite-js dependency.
 *
 * Usage:
 *   <SDSProvider colorPreference="light">
 *     <App />
 *   </SDSProvider>
 */
import React, { type PropsWithChildren } from 'react';
import type { ColorPreference } from '../foundation/colors';
import { AdaptiveColorProvider } from './AdaptiveColorProvider';
import { OverlayProvider } from './OverlayProvider';
import { ThemeProvider, type ThemeProviderProps } from './ThemeProvider';
import { TypographyProvider } from './TypographyProvider';

export interface SDSProviderProps extends ThemeProviderProps {
  /** Light or dark color scheme. @default 'light' */
  colorPreference?: ColorPreference;
}

export function SDSProvider({
  colorPreference = 'light',
  token,
  children,
}: PropsWithChildren<SDSProviderProps>) {
  return (
    <AdaptiveColorProvider colorPreference={colorPreference}>
      <TypographyProvider>
        <ThemeProvider token={token}>
          <OverlayProvider>{children}</OverlayProvider>
        </ThemeProvider>
      </TypographyProvider>
    </AdaptiveColorProvider>
  );
}
