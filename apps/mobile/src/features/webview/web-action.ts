/**
 * Perform a page's `web:action`, for both web shells (`/webview`, `/mini-app`).
 *
 * Call it only AFTER the origin gate (`resolveWebviewCapabilities`) granted
 * `web:action` to the document that posted. The gate decides who may ask;
 * `resolveWebAction` decides what they may ask for — `map` and `miniapp` only,
 * each value checked against its own anchored grammar. What survives both goes
 * through the ordinary action dispatcher, so a page's `map` action and a
 * server's are one code path.
 */
import { resolveWebAction } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';

export function performWebAction(actionType: string, actionValue: string): void {
  const action = resolveWebAction(actionType, actionValue);
  if (!action) {
    if (__DEV__) console.debug('[webview] web:action refused:', actionType, actionValue);
    return;
  }
  handleSduiAction(action);
}
