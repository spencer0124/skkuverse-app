/**
 * Unified action dispatcher for all SDUI components.
 *
 * Handles route navigation, in-app webview, and external URL launching.
 * Used by button grid items, banners, notices, and any future SDUI actions.
 *
 * Flutter source: lib/core/utils/sdui_action_handler.dart
 */

import { router } from 'expo-router';
import { parseMapPlaceRef, parseMiniAppTarget, type ActionType } from '@skkuverse/shared';
import { openMiniAppTarget } from '@/features/mini-app/open';
import { openMapAtPlace } from '@/lib/open-map-place';
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

    // A mini-app target, `<miniAppId>[/path]` — opens the registered mini app's
    // shell, at that page when a path is given (eventmap §7.3). A value that is
    // not a target does nothing: it is never treated as a URL.
    case 'miniapp': {
      const target = parseMiniAppTarget(actionValue);
      if (target) {
        openMiniAppTarget(target);
      } else if (__DEV__) {
        console.debug('[sdui] miniapp action with no valid target ignored:', actionValue);
      }
      break;
    }

    // A place on the campus map, `[<kind>:]<placeId>` — the `?place=` grammar.
    // Closes whatever shell is on top and opens that place's sheet. A value that
    // is not a place reference does nothing.
    case 'map': {
      const ref = parseMapPlaceRef(actionValue);
      if (ref) {
        openMapAtPlace(ref);
      } else if (__DEV__) {
        console.debug('[sdui] map action with no valid place ignored:', actionValue);
      }
      break;
    }

    case 'content':
    case 'unknown':
      // `content` is prose to render in place, and this dispatcher is
      // fire-and-forget with no surface to render into — the sheet that owns the
      // button handles it before ever calling here. Reaching this arm means a
      // call site rendered a button for something that was never navigable.
      //
      // `unknown` is what an unrecognised action type parses to. It used to
      // become 'external' and open a browser at whatever string arrived.
      if (__DEV__) {
        console.debug('[sdui] non-navigable action type ignored:', actionType);
      }
      break;

    default: {
      // Exhaustiveness check — a new ActionType is a compile error here rather
      // than a silent no-op. Mirrors renderer.tsx.
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}
