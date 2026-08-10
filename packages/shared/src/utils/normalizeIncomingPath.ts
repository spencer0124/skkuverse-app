/**
 * Normalize an incoming deep-link string to a pathname plus its query params.
 *
 * Per Expo native-intent docs: "While the parameter is called `path` there is no
 * guarantee that this is a path or a valid URL." Both cold and warm start hand
 * over the full launch URL, but a bare pathname can also arrive, so both forms
 * are handled.
 *
 * ## The authority fold
 *
 * `skkuverse:` is a **non-special** scheme (only http/https/ws/wss/ftp/file are
 * special), so the WHATWG parser reads the first segment after `//` as the
 * *authority*, not as the path:
 *
 *   skkuverse://map?place=x   →  hostname "map",  pathname ""
 *   skkuverse:///map?place=x  →  hostname "",     pathname "/map"
 *
 * Both spellings mean the same route, and only the second one used to work —
 * every `skkuverse://<something>` link collapsed to "/" and lost its query, which
 * silently broke `//campus`, `//search`, `//m/<slug>` and `//notices/<a>/<b>`
 * despite docs/reference/deep-link.md listing them as supported. So for our own
 * scheme the authority is folded back into the path.
 *
 * Three details that are easy to get wrong, all verified against
 * `whatwg-url-without-unicode`, which is what Expo installs as the runtime `URL`:
 *
 * - **Opaque hosts are not lowercased** by the parser, so `skkuverse://MAP/HSSC`
 *   yields hostname "MAP". A poster or QR code carrying a capitalised link would
 *   miss the whitelist. `protocol` *is* always lowercased, so the scheme
 *   comparison below is safe as-is. Only the folded segment is lowercased — the
 *   path must keep its case, since `/m/<Slug>` ids are case-sensitive.
 * - **`hostname`, not `host`**: `host` carries the port, so `skkuverse://map:8080/x`
 *   would fold to `/map:8080/x`.
 * - **`skkuverse:map?place=x`** (no slashes at all, which Android intents can
 *   produce) parses to hostname "" and pathname "map" — no leading slash.
 *
 * http(s) is never folded: there the host is a real domain, and
 * `https://evil.com/map` must stay `/map` rather than becoming `/evil.com/map`.
 *
 * Used by apps/mobile/app/+native-intent.tsx redirectSystemPath. Pure +
 * vitest-testable here; co-located with resolveInitialTabRouteName.
 */

const APP_SCHEME = 'skkuverse:';

/**
 * Base for the relative form. Its authority ("app") is an artifact of needing a
 * base at all — never fold it, which is why the relative branch is separate.
 */
const RELATIVE_BASE = 'skkuverse://app';

export interface IncomingLink {
  /** Always starts with "/". The universal-link "/p/" namespace is stripped. */
  pathname: string;
  params: URLSearchParams;
}

export function parseIncomingLink(rawPath: string): IncomingLink {
  // Absolute form: cold-start launch URL, universal link, custom scheme.
  try {
    const url = new URL(rawPath);
    const path =
      url.protocol === APP_SCHEME && url.hostname
        ? `/${url.hostname.toLowerCase()}${url.pathname}`
        : url.pathname;
    return finish(path, url.searchParams);
  } catch {
    // Not absolute (a bare pathname throws) — fall through.
  }

  // Relative form: a bare pathname such as "/p/notices/x/y". The base supplies
  // the authority, so there is nothing here to fold.
  try {
    const url = new URL(rawPath, RELATIVE_BASE);
    return finish(url.pathname, url.searchParams);
  } catch {
    // URL itself is unavailable or broken. Degrade to string surgery rather than
    // dropping the link.
    return finish(stripQueryAndFragment(rawPath), new URLSearchParams());
  }
}

/** Pathname only. Kept so existing call sites that ignore the query are unchanged. */
export function normalizeIncomingPath(rawPath: string): string {
  return parseIncomingLink(rawPath).pathname;
}

function finish(rawPathname: string, params: URLSearchParams): IncomingLink {
  let pathname = rawPathname;
  if (pathname === '') pathname = '/';
  else if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  // Universal-link namespace: "/p/<rest>" → "/<rest>".
  if (pathname.startsWith('/p/')) pathname = pathname.substring(2);
  return { pathname, params };
}

function stripQueryAndFragment(raw: string): string {
  let out = raw;
  const q = out.indexOf('?');
  if (q !== -1) out = out.substring(0, q);
  const hash = out.indexOf('#');
  if (hash !== -1) out = out.substring(0, hash);
  return out;
}
