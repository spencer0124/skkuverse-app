import { postToApp } from '@skkuverse/bridge';
import type { MapSelectPayload } from '@skkuverse/bridge';

/**
 * Open a URL in the native app (replaces flutterCommunicate).
 * Handles tel:, nmap://, kakaomap://, maps://, https:// etc.
 */
export function openUrl(url: string): void {
  postToApp({ type: 'web:open-url', url });
}

/**
 * Send map selection data to the native app (replaces flutterMapCommunicate).
 */
export function sendMapSelect(payload: MapSelectPayload): void {
  postToApp({ type: 'web:map-select', payload });
}
