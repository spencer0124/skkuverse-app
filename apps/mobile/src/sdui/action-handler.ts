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
import type { ActionType } from '@skkuverse/shared';

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
      // Bare `/` means "go home from anywhere". router.push would leave a
      // titleless app/index.tsx entry in the root Stack (long-press back
      // shows blank); router.dismissTo retains v3-navigate semantics
      // (pop-to-target if in dismissable history, else navigate) which
      // matches the intent. v4+ removed router.navigate's smart behavior
      // — see expo/expo#35212.
      if (actionValue === '/') {
        router.dismissTo('/(tabs)/home' as never);
        break;
      }
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
