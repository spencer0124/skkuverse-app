/**
 * Unified action dispatcher for all SDUI components.
 *
 * Handles route navigation, in-app webview, and external URL launching.
 * Used by button grid items, banners, notices, and any future SDUI actions.
 *
 * Flutter source: lib/core/utils/sdui_action_handler.dart
 */

import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
      WebBrowser.openBrowserAsync(actionValue);
      break;
  }
}
