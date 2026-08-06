/**
 * URL normalization shared by the two webview entry points.
 *
 * Both shells face the same two problems before they can render anything:
 *
 *   - `http://` has to be upgraded to `https://`, because iOS ATS blocks
 *     cleartext http and the WebView just shows a blank page.
 *   - Non-web schemes (`mailto:`, `tel:`, `itms-apps:`, …) can't be rendered by
 *     a WebView at all and must be handed to the OS.
 *
 * Lives in lib/ rather than in either feature so the mini-app shell and the
 * generic webview can't drift on it.
 */

export interface NormalizedUrl {
  /** http→https upgraded, trimmed. */
  url: string;
  /** true when the result is an https URL a WebView can actually load. */
  isWeb: boolean;
}

export function normalizeWebUrl(raw: string): NormalizedUrl {
  const trimmed = (raw ?? '').trim();
  const url = trimmed.startsWith('http://')
    ? `https://${trimmed.slice('http://'.length)}`
    : trimmed;
  return { url, isWeb: url.startsWith('https://') };
}
