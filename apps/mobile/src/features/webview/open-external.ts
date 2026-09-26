/**
 * `web:open-url` with an app to try first.
 *
 * Open the app's scheme outright instead of asking `canOpenURL` first. The ask
 * is what the platforms gate (iOS `LSApplicationQueriesSchemes`, Android 11+
 * `<queries>`), and both need a native build; the open itself is not gated,
 * and it rejects when nothing handles the scheme. So the rejection is the probe,
 * and `url` — the web address — is what it falls back to.
 *
 * Only a rejection falls back. An app that takes the scheme but ignores its
 * path — Instagram with `instagram://p/<shortcode>` opens its home feed — never
 * reaches `url`, so a site whose https links its app already claims needs no
 * `appUrl` at all (`lib/instagram-url.ts`).
 *
 * The fallback stays external (`Linking.openURL`), not the in-app /webview
 * screen: `web:open-url` has always meant "leave the page", and pushing a
 * second webview over a mini app would stack two browsers.
 *
 * Dependency-free — the opener is passed in — so `node --test` can drive the
 * reject path without a React Native runtime.
 */
export interface ExternalTarget {
  url: string;
  appUrl?: string;
}

export async function openAppFirst(
  { url, appUrl }: ExternalTarget,
  open: (url: string) => Promise<unknown>,
): Promise<void> {
  if (appUrl) {
    try {
      await open(appUrl);
      return;
    } catch {
      // Nothing on the device handles the scheme. The web address below is the
      // deterministic fallback.
    }
  }
  await open(url).catch(() => {});
}
