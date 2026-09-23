/**
 * Leaving the place sheet, and coming back to it.
 *
 * **Both hooks dismiss the sheet BEFORE they navigate.** That is a portal
 * ordering constraint rather than polish: the sheet is presented above the root
 * navigator, so pushing a destination under a live modal arrives damaged
 * (`docs/explanation/eventmap-rendering.md` §7.1). `onNavigateAway` is fired
 * first so the screen can tell this dismiss apart from the user's own and hold
 * the selection for the way back.
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
import { handleSduiAction } from '@/sdui/action-handler';
import { instagramDestination } from './instagram';

export function useInstagramNavigate(onNavigateAway?: () => void) {
  const { dismiss } = useBottomSheetModal();
  return useCallback(
    (action: PlaceInstagramAction, title: string) => {
      onNavigateAway?.();
      dismiss();
      void openInstagram(action, title);
    },
    [dismiss, onNavigateAway],
  );
}

async function openInstagram(action: PlaceInstagramAction, title: string): Promise<void> {
  const destination = instagramDestination(action.profileUrl, action.postUrl);
  if (destination) {
    try {
      if (await Linking.canOpenURL('instagram://app')) {
        await Linking.openURL(destination.nativeUrl);
        return;
      }
    } catch {
      // The installed app rejected the deep link. The in-app browser below is
      // the deterministic fallback rather than losing the visitor to a blank
      // system-browser tab.
    }
  }
  openWebView({ url: destination?.webUrl ?? action.profileUrl, title });
}

/** Leave the sheet for a legacy link, and come back to it. */
export function usePlaceNavigate(onNavigateAway?: () => void) {
  const { dismiss } = useBottomSheetModal();
  return useCallback(
    ({ actionType, actionValue, title }: { actionType: ActionType; actionValue: string; title: string }) => {
      onNavigateAway?.();
      dismiss();
      handleSduiAction({ actionType, actionValue, webviewTitle: title });
    },
    [dismiss, onNavigateAway],
  );
}
