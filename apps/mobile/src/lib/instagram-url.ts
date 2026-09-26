/**
 * Instagram links leave the app as their plain https address, handed to the OS.
 *
 * Instagram claims its https links itself — its apple-app-site-association
 * (iOS universal links) and assetlinks.json (Android app links) route every
 * `instagram.com` path to the app — so `Linking.openURL` opens the post or
 * profile in Instagram when it is installed and in the browser when it is not.
 * The `instagram://p/<shortcode>` scheme is no substitute: Instagram accepts it
 * but opens its home feed, not the post, and because the open does not reject,
 * nothing falls back. An in-app webview is no substitute either: a page loaded
 * inside it never reaches the Instagram app.
 *
 * Every door that can meet an Instagram link — `openWebView`, the place sheet,
 * a link tapped inside /webview or /mini-app — asks here, so they cannot drift.
 * The place sheet's choice between a post and a profile lives here too, being
 * the one other place that reads an Instagram URL.
 *
 * Dependency-free so `node --test` can drive it without a React Native runtime.
 */

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);

/** `value` as a URL when it is an https Instagram address, else null. */
function instagramUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && INSTAGRAM_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

/** Whether `value` is an https Instagram address, which the OS should open. */
export function isInstagramUrl(value: string): boolean {
  return instagramUrl(value) !== null;
}

/**
 * Whether a webview should hand this load to the OS instead of navigating to
 * it. Only a top-frame load qualifies: iOS asks about iframes too
 * (`isTopFrame: false`), and an Instagram embed on a page has to keep loading
 * in place rather than throw the visitor into the app. Android reports top
 * frames only and leaves `isTopFrame` unset.
 */
export function handsOffToOs(request: { url: string; isTopFrame?: boolean }): boolean {
  return request.isTopFrame !== false && isInstagramUrl(request.url);
}

const RESERVED_PROFILE_PATHS = new Set([
  'accounts',
  'direct',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
]);

function isProfile(value: string): boolean {
  const url = instagramUrl(value);
  if (!url) return false;
  const [username, extra] = url.pathname.split('/').filter(Boolean);
  return !!username && !extra && !RESERVED_PROFILE_PATHS.has(username.toLowerCase());
}

function isMedia(value: string): boolean {
  const url = instagramUrl(value);
  if (!url) return false;
  const [kind, shortcode, extra] = url.pathname.split('/').filter(Boolean);
  return !!shortcode && !extra && ['p', 'reel', 'reels'].includes(kind?.toLowerCase() ?? '');
}

/**
 * The address a place's Instagram action opens: its post or reel when that is
 * a well-formed one, else its profile, else nothing. The server validates both
 * already; this keeps a malformed authored value from leaving the app at all.
 */
export function instagramDestination(profileUrl: string, postUrl: string | null): string | null {
  if (postUrl && isMedia(postUrl)) return postUrl;
  return isProfile(profileUrl) ? profileUrl : null;
}
