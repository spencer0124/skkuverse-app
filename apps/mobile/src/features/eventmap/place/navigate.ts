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
 * sheet held down for it would stay down too.
 *
 * This file used to also hold a pill row that drew these actions. The facts
 * card draws them as rows now, so only the navigation is left — and with no JSX
 * it is a `.ts`.
 */

import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useBottomSheetModal } from '@gorhom/bottom-sheet';
import type { ActionType, PlaceInstagramAction } from '@skkuverse/shared';
import { openWebView } from '@/features/webview/open';
import { normalizeWebUrl } from '@/lib/web-url';
import { handleSduiAction } from '@/sdui/action-handler';
import { instagramDestination, openInstagramAppFirst } from './instagram';

export function useInstagramNavigate(onNavigateAway?: () => void) {
  const { dismiss } = useBottomSheetModal();
  return useCallback(
    (action: PlaceInstagramAction, title: string) => {
      const destination = instagramDestination(action.profileUrl, action.postUrl);
      // The fallback is the in-app browser rather than losing the visitor to a
      // blank system-browser tab — and, being a push, it is the one path here
      // that takes the sheet down first.
      void openInstagramAppFirst(
        destination?.nativeUrl ?? null,
        (url) => Linking.openURL(url),
        () => {
          onNavigateAway?.();
          dismiss();
          openWebView({ url: destination?.webUrl ?? action.profileUrl, title });
        },
      );
    },
    [dismiss, onNavigateAway],
  );
}

/**
 * Whether an action leaves the app rather than pushing a screen. A web-shell
 * action whose value is not a web URL is handed to the OS by `openWebView`.
 */
function leavesApp(actionType: ActionType, actionValue: string): boolean {
  return (
    (actionType === 'webview' || actionType === 'external') &&
    !normalizeWebUrl(actionValue).isWeb
  );
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
