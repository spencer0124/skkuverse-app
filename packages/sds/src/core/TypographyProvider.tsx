/**
 * Typography Provider — provides resolved typography map to components.
 */
import React, { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { typographyMap, type TypographyKeys, type TypographyStyle } from '../foundation/typography';

export type TypographyMap = Record<TypographyKeys, TypographyStyle>;

export interface TypographyTheme {
  typography: TypographyMap;
}

const defaultValue: TypographyTheme = {
  typography: typographyMap,
};

const TypographyContext = createContext<TypographyTheme>(defaultValue);

export function TypographyProvider({ children }: PropsWithChildren) {
  // For now, use the fixed typography map.
  // Font scaling support can be added later.
  const value = useMemo<TypographyTheme>(() => defaultValue, []);

  return (
    <TypographyContext.Provider value={value}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypographyTheme(): TypographyTheme {
  return useContext(TypographyContext);
}
