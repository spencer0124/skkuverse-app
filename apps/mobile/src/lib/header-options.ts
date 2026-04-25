/**
 * Shared native Stack header options used by:
 *   - app/_layout.tsx (root)
 *   - app/bus/_layout.tsx
 *   - app/notices/_layout.tsx
 *   - app/(tabs)/<tab>/_layout.tsx (per-tab inner Stack)
 *
 * iOS = UINavigationController, Android = Toolbar (react-native-screens
 * native-stack). headerBackButtonDisplayMode: 'minimal' removes the
 * automatic "← previous-screen-name" text on iOS, leaving the chevron only.
 */

import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { SdsColors } from '@skkuverse/shared';

export const defaultHeaderOptions: NativeStackNavigationOptions = {
  headerTitleAlign: 'center',
  headerBackButtonDisplayMode: 'minimal',
  headerShadowVisible: false,
  headerTintColor: SdsColors.grey900,
  headerStyle: { backgroundColor: SdsColors.background },
  headerTitleStyle: { fontWeight: '700' },
};
