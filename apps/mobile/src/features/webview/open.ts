/**
 * Generic webview entry point.
 *
 * This is the door for ANY web URL that is not a registered mini-app: notice
 * source pages, links inside notice markdown, SDUI `external` actions, and the
 * first-party SPA pages (분실물, bus info).
 *
 * It used to be `openInAppBrowser()`, a one-line wrapper over `openMiniApp()`,
 * which is how arbitrary notice pages ended up inside the mini-app shell with a
 * bookmark button and an "add to home screen" menu. The two are now genuinely
 * separate destinations; there is deliberately no helper that blurs them again.
 *
 * What the loaded page is allowed to do is NOT decided here — the /webview
 * screen resolves that per message from the document's own origin. See
 * `features/webview/capabilities.ts`.
 */
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { normalizeWebUrl } from '@/lib/web-url';

export interface OpenWebViewParams {
  url: string;
  /** Header title. Empty falls back to the page's own <title>. */
  title?: string;
}

export function openWebView({ url, title }: OpenWebViewParams): void {
  const { url: normalized, isWeb } = normalizeWebUrl(url);
  if (!isWeb) {
    // mailto:/tel:/itms-apps: etc. — a WebView can't render these.
    void Linking.openURL((url ?? '').trim()).catch(() => {});
    return;
  }
  router.push({
    pathname: '/webview',
    params: { url: normalized, title: title ?? '' },
  } as never);
}
