/**
 * Adaptive Color Provider — provides theme-aware color values.
 */
import React, { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { getAdaptiveColors, type ColorPreference } from '../foundation/colors';

type AdaptiveColors = ReturnType<typeof getAdaptiveColors>;

const AdaptiveColorContext = createContext<AdaptiveColors>(getAdaptiveColors('light'));

interface Props {
  colorPreference: ColorPreference;
}

export function AdaptiveColorProvider({
  colorPreference,
  children,
}: PropsWithChildren<Props>) {
  const colors = useMemo(() => getAdaptiveColors(colorPreference), [colorPreference]);

  return (
    <AdaptiveColorContext.Provider value={colors}>
      {children}
    </AdaptiveColorContext.Provider>
  );
}

/** Returns theme-aware color values based on current color preference */
export function useAdaptive(): AdaptiveColors {
  return useContext(AdaptiveColorContext);
}
