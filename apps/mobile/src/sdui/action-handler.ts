/**
 * Unified action dispatcher for all SDUI components.
 *
 * Handles route navigation, in-app webview, and external URL launching.
 * Used by button grid items, banners, notices, and any future SDUI actions.
 *
 * Flutter source: lib/core/utils/sdui_action_handler.dart
 */

import { Linking } from 'react-native';
import { router } from 'expo-router';
import type { ActionType } from '@skkuuniverse/shared';

interface SduiAction {
  actionType: ActionType;
  actionValue: string;
  webviewTitle?: string;
  webviewColor?: string;
}

export function handleSduiAction({
  actionType,
  actionValue,
  webviewTitle,
  webviewColor,
}: SduiAction): void {
  switch (actionType) {
    case 'route':
      router.push(actionValue as never);
      break;

    case 'webview':
      // Webview screen doesn't exist yet — will be added in Phase 7.3
      router.push({
        pathname: '/webview',
        params: {
          title: webviewTitle ?? '',
          color: webviewColor ?? '003626',
          url: actionValue,
        },
      } as never);
      break;

    case 'external':
      Linking.openURL(actionValue);
      break;
  }
}
