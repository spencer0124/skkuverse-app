/**
 * Generic webview entry point.
 *
 * This is the door for ANY web URL that is not a registered mini-app: notice
 * source pages, links inside notice markdown, SDUI `external` actions, and the
 * first-party SPA pages (분실물, bus info).
 *
 * A URL on a first-party mini-app origin is handed to that mini app's shell
 * instead, whoever asked: a place-detail link, a banner, a campus chip. In
 * /webview such a page finds no `window.skkuverse`, and its SDK shows a
 * full-screen "open in the app" gate instead of the page. Which origins count
 * is server-owned (`getMiniAppOrigins()`, from GET /app/config), and each is
 * owned outright by one mini app, so the URL alone names it — the way App Links
 * and Universal Links route by the host that owns a URL, not by who linked it.
 *
 * It used to be `openInAppBrowser()`, a one-line wrapper over `openMiniApp()`,
 * which is how arbitrary notice pages ended up inside the mini-app shell with a
 * bookmark button and an "add to home screen" menu. The two are now genuinely
 * separate destinations; there is deliberately no helper that blurs them again.
 *
 * An Instagram address never reaches a webview either: it goes to the OS as
 * is, and Instagram's own universal/app link opens it in the app, or the
 * browser opens it without one (`lib/instagram-url.ts`).
 *
 * What the loaded page is allowed to do is NOT decided here — the /webview
 * screen resolves that per message from the document's own origin. See
 * `features/webview/capabilities.ts`.
 */
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { getMiniAppOrigins, miniAppTargetForUrl } from '@skkuverse/shared';
import { openMiniAppTarget } from '@/features/mini-app/open';
import { handsOffToOs, isInstagramUrl } from '@/lib/instagram-url';
import { normalizeWebUrl } from '@/lib/web-url';

export interface OpenWebViewParams {
  url: string;
  /** Header title. Empty falls back to the page's own <title>. */
  title?: string;
}

/**
 * Whether `openWebView` hands `url` to the OS rather than pushing a screen: a
 * non-web scheme a WebView cannot render (`mailto:`, `tel:`, `itms-apps:`), or
 * an Instagram address. The place sheet asks too, to stay up for an app switch.
 */
export function leavesApp(url: string): boolean {
  const { url: normalized, isWeb } = normalizeWebUrl(url);
  return !isWeb || isInstagramUrl(normalized);
}

export function openWebView({ url, title }: OpenWebViewParams): void {
  const { url: normalized, isWeb } = normalizeWebUrl(url);
  if (leavesApp(url)) {
    void Linking.openURL(isWeb ? normalized : (url ?? '').trim()).catch(() => {});
    return;
  }
  const target = miniAppTargetForUrl(normalized, getMiniAppOrigins());
  if (target) {
    openMiniAppTarget(target);
    return;
  }
  router.push({
    pathname: '/webview',
    params: { url: normalized, title: title ?? '' },
  } as never);
}

/**
 * `onShouldStartLoadWithRequest` for the /webview and /mini-app shells: an
 * Instagram link tapped in the page goes to the OS instead of loading in the
 * webview, where it would never reach the Instagram app. Everything else —
 * including an Instagram embed in an iframe — loads as before.
 */
export function handOffAppLinks(request: { url: string; isTopFrame?: boolean }): boolean {
  if (!handsOffToOs(request)) return true;
  void Linking.openURL(request.url).catch(() => {});
  return false;
}
