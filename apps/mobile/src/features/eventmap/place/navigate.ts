/**
 * Leaving the place sheet, and coming back to it.
 *
 * **The sheet is dismissed BEFORE an in-app push, and only then.** Dismissing
 * first is a portal ordering constraint rather than polish: the sheet is
 * presented above the root navigator, so pushing a destination under a live
 * modal arrives damaged (`docs/explanation/eventmap-rendering.md` §7.1).
 * `onNavigateAway` is fired first so the screen can tell this dismiss apart from
 * the user's own and hold the selection for the way back, which a focus event
 * brings.
 *
 * Leaving for another app — Instagram, a `tel:` or `mailto:` link — pushes
 * nothing, so the sheet stays up. It has to: an app switch sends no navigator
 * focus, so a sheet dismissed for one would never be restored, and the campus
 * sheet held down for it would stay down too. Instagram always leaves: its
 * https address goes to the OS, which opens it in Instagram or the browser.
 *
 * This file used to also hold a pill row that drew these actions. The facts
 * card draws them as rows now, so only the navigation is left — and with no JSX
 * it is a `.ts`.
 */

import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useBottomSheetModal } from '@gorhom/bottom-sheet';
import type { ActionType, PlaceInstagramAction } from '@skkuverse/shared';
import { leavesApp as urlLeavesApp } from '@/features/webview/open';
import { instagramDestination } from '@/lib/instagram-url';
import { handleSduiAction } from '@/sdui/action-handler';

/** Open a place's Instagram post or profile in Instagram, with the sheet left up. */
export function useInstagramNavigate() {
  return useCallback((action: PlaceInstagramAction) => {
    const url = instagramDestination(action.profileUrl, action.postUrl);
    if (url) void Linking.openURL(url).catch(() => {});
  }, []);
}

/**
 * Whether an action leaves the app rather than pushing a screen: a web-shell
 * action whose value `openWebView` hands to the OS.
 */
function leavesApp(actionType: ActionType, actionValue: string): boolean {
  return (actionType === 'webview' || actionType === 'external') && urlLeavesApp(actionValue);
}

/** Leave the sheet for a legacy link, and come back to it. */
export function usePlaceNavigate(onNavigateAway?: () => void) {
  const { dismiss } = useBottomSheetModal();
  return useCallback(
    ({ actionType, actionValue, title }: { actionType: ActionType; actionValue: string; title: string }) => {
      if (!leavesApp(actionType, actionValue)) {
        onNavigateAway?.();
        dismiss();
      }
      handleSduiAction({ actionType, actionValue, webviewTitle: title });
    },
    [dismiss, onNavigateAway],
  );
}
