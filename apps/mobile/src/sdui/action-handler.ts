/**
 * Unified action dispatcher for all SDUI components.
 *
 * Handles route navigation, in-app webview, and external URL launching.
 * Used by button grid items, banners, notices, and any future SDUI actions.
 *
 * Flutter source: lib/core/utils/sdui_action_handler.dart
 */

import { router } from 'expo-router';
import type { ActionType } from '@skkuverse/shared';
import { openWebView } from '@/features/webview/open';

interface SduiAction {
  actionType: ActionType;
  actionValue: string;
  webviewTitle?: string;
  /**
   * Server-supplied theme colour. Accepted but unused: the old /webview screen
   * declared it and never read it either. Kept on the interface so call sites
   * and the server contract don't have to change.
   */
  webviewColor?: string;
}

export function handleSduiAction({
  actionType,
  actionValue,
  webviewTitle,
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

    // Both land on the same shell. They stay distinct action types because the
    // server still emits both and old clients treat them differently, but on
    // this side the only difference is whether a title came along. What the
    // loaded page may do is decided by its origin, not by which verb opened it.
    case 'webview':
    case 'external':
      openWebView({ url: actionValue, title: webviewTitle });
      break;
  }
}
