/**
 * Instagram URL parsing stays pure so the sheet can reject malformed authored
 * values before it asks the operating system to leave the app.
 */

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const RESERVED_PROFILE_PATHS = new Set([
  'accounts',
  'direct',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
]);

export interface InstagramDestination {
  /** The canonical page to show in the app webview when Instagram is absent. */
  webUrl: string;
  /** The app scheme to try when the Instagram app is installed. */
  nativeUrl: string;
}

function instagramUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && INSTAGRAM_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

function profileUsername(value: string): string | null {
  const url = instagramUrl(value);
  if (!url) return null;
  const [username, extra] = url.pathname.split('/').filter(Boolean);
  if (!username || extra || RESERVED_PROFILE_PATHS.has(username.toLowerCase())) return null;
  return username;
}

function mediaPath(value: string): string | null {
  const url = instagramUrl(value);
  if (!url) return null;
  const [kind, shortcode, extra] = url.pathname.split('/').filter(Boolean);
  if (!shortcode || extra || !['p', 'reel', 'reels'].includes(kind?.toLowerCase() ?? '')) return null;
  return `${kind.toLowerCase()}/${shortcode}`;
}

/**
 * Prefer the authored post/reel for both destinations. Instagram accepts these
 * path-shaped deep links on iOS and Android; a profile uses its documented
 * username scheme. Invalid post URLs fall back to the valid profile.
 */
export function instagramDestination(profileUrl: string, postUrl: string | null): InstagramDestination | null {
  const post = postUrl ? mediaPath(postUrl) : null;
  if (post) return { webUrl: postUrl!, nativeUrl: `instagram://${post}` };

  const username = profileUsername(profileUrl);
  if (!username) return null;
  return {
    webUrl: profileUrl,
    nativeUrl: `instagram://user?username=${encodeURIComponent(username)}`,
  };
}

/**
 * Try the Instagram app, and only when it will not open run `fallback`.
 *
 * The split is what the place sheet depends on: `fallback` is the in-app push,
 * the one path that has to take the sheet down first. Opening Instagram leaves
 * the app instead, and the sheet stays up for the way back — no navigator
 * focus follows an app switch, so a sheet dismissed for it would never return.
 *
 * The open is tried outright rather than asked about with `canOpenURL`: the ask
 * is what the platforms gate (iOS `LSApplicationQueriesSchemes`, Android 11+
 * `<queries>`), and both need a native build; the open itself is not gated, and
 * it rejects when nothing handles the scheme. So the rejection is the probe.
 *
 * Dependency-free — the opener is passed in — so `node --test` can drive both
 * paths without a React Native runtime.
 */
export async function openInstagramAppFirst(
  nativeUrl: string | null,
  open: (url: string) => Promise<unknown>,
  fallback: () => void,
): Promise<void> {
  if (nativeUrl) {
    try {
      await open(nativeUrl);
      return;
    } catch {
      // Instagram is absent, or rejected the deep link.
    }
  }
  fallback();
}
