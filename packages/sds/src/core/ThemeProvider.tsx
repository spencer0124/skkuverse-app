/**
 * SDS Theme Provider — seed token → derived token system.
 *
 * Cloned from TDS ThemeProvider, adapted for SDS color tokens.
 * Provides theme context to all SDS components.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { SdsColors } from '@skkuverse/shared';
import { colorSeeds } from '../foundation/colors';

// ── Seed Token ──

export interface SeedToken {
  color: {
    primary: string;
  };
}

export const defaultSeedToken: SeedToken = {
  color: {
    primary: colorSeeds.primary,
  },
};

// ── Derived Tokens (computed from seed) ──

export interface ButtonDerivedTheme {
  backgroundFillColor: string;
  textFillColor: string;
  backgroundWeakColor: string;
  textWeakColor: string;
  dimFillColor: string;
  dimWeakColor: string;
  loaderFillColor: string;
  loaderWeakColor: string;
}

export interface DerivedToken {
  button: ButtonDerivedTheme;
}

/** Parse any hex (#RGB, #RRGGBB, #RRGGBBAA) into rgba() with custom alpha */
function hexToRgba(hex: string, alpha: number): string {
  let r = 0, g = 0, b = 0;
  const h = hex.replace('#', '');
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else if (h.length >= 6) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function deriveButtonTheme(seed: SeedToken): ButtonDerivedTheme {
  const primary = seed.color.primary;
  return {
    backgroundFillColor: primary,
    textFillColor: SdsColors.background,
    backgroundWeakColor: SdsColors.grey100,
    textWeakColor: primary,
    dimFillColor: hexToRgba(primary, 0.25),
    dimWeakColor: SdsColors.greyOpacity50,
    loaderFillColor: SdsColors.background,
    loaderWeakColor: primary,
  };
}

function deriveToken(seed: SeedToken): DerivedToken {
  return {
    button: deriveButtonTheme(seed),
  };
}

// ── Theme Token (seed + derived) ──

export type ThemeToken = SeedToken & DerivedToken;

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ── Context ──

interface ThemeContextValue {
  token: ThemeToken;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  token?: DeepPartial<ThemeToken>;
  children: React.ReactNode;
}

export function ThemeProvider({ token: customToken, children }: ThemeProviderProps) {
  const parentTheme = useContext(ThemeContext);

  const value = useMemo<ThemeContextValue>(() => {
    const baseSeed = parentTheme?.token ?? defaultSeedToken;

    // Merge custom token with base
    const seed: SeedToken = {
      color: {
        primary: customToken?.color?.primary ?? baseSeed.color.primary,
      },
    };

    const derived = deriveToken(seed);

    // Allow overriding derived tokens directly
    const mergedButton: ButtonDerivedTheme = {
      ...derived.button,
      ...(customToken?.button as Partial<ButtonDerivedTheme> | undefined),
    };

    return {
      token: {
        ...seed,
        button: mergedButton,
      },
    };
  }, [customToken, parentTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback: return default theme if no provider
    const seed = defaultSeedToken;
    return { token: { ...seed, ...deriveToken(seed) } };
  }
  return ctx;
}

export { ThemeContext };
