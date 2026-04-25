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
 *
 * Why headerBackImageSource (only the icon image is overridden):
 *   We swap *only* the chevron PNG so UINavigationController retains its
 *   native intelligence — auto-hides on stack root (no canGoBack drift across
 *   nested navigators), preserves edge-swipe back gesture, VoiceOver "Back"
 *   label, and on iOS 26 wraps the button in a Liquid Glass capsule whose
 *   metrics match HeaderIconButton (36×36) on the right. The PNG is a
 *   phosphor `caret-left` baked at GREY_700 by scripts/export-header-icons.mjs
 *   (see notices tab unstable_headerRightItems for the same pattern).
 */

import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { SdsColors } from '@skkuverse/shared';

const ICON_BACK = require('../../assets/header-icons/caret-left.png');

export const defaultHeaderOptions: NativeStackNavigationOptions = {
  headerTitleAlign: 'center',
  headerBackButtonDisplayMode: 'minimal',
  headerShadowVisible: false,
  headerTintColor: SdsColors.grey900,
  headerStyle: { backgroundColor: SdsColors.background },
  headerTitleStyle: { fontWeight: '700' },
  headerBackImageSource: ICON_BACK,
};
