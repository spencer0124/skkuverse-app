/**
 * The mini-app target — which registered mini app to open, and at which page.
 *
 *     <miniAppId>[<root-relative path>]
 *
 *     eskara-2026                     the mini app's registered startUrl
 *     eskara-2026/eskara/wristband    that page, on the startUrl's origin
 *
 * One grammar for every way into the shell: a map `miniapp` action, a mini-app
 * push's `miniapp` action, and the `/m/<target>` deep link, which is this string
 * with `/m/` in front. The server validates the same grammar before it ships a
 * value (skkuverse-server `src/miniapps/miniapp-target.ts`); keep the two in step.
 *
 * An id and a path rather than a URL, because an origin does not name a mini app
 * — one host can serve several — and the shell needs the id for the name, logo
 * and verified badge it frames the page with.
 */

export interface MiniAppTarget {
  id: string;
  /** Root-relative, on the mini app's registered origin. Absent means startUrl. */
  path?: string;
}

// The slug is the leading run up to the first `/`, which is also where the path
// starts — so the split needs no delimiter a path could contain.
const TARGET_RE = /^([a-z0-9-]+)(\/.*)?$/;
// `//evil.com` and `/\evil.com` are both read by a URL parser as a new
// authority, so neither may start a path. Same rule as the server's
// ROOT_RELATIVE_PATH_RE.
const ROOT_RELATIVE_PATH_RE = /^\/(?![/\\])[^\s]*$/;
const WHITESPACE_RE = /\s/;

/** Parse a target, or null when the string is not one. */
export function parseMiniAppTarget(value: unknown): MiniAppTarget | null {
  // Whitespace is refused before matching: `$` without the `m` flag still
  // matches before a trailing newline.
  if (typeof value !== 'string' || value === '' || WHITESPACE_RE.test(value)) {
    return null;
  }
  const match = TARGET_RE.exec(value);
  if (!match) return null;
  const [, id, path] = match;
  if (!id) return null;
  if (path === undefined) return { id };
  if (!ROOT_RELATIVE_PATH_RE.test(path)) return null;
  return { id, path };
}

/**
 * The URL the shell should load: `path` resolved against the registered
 * `startUrl`, or `startUrl` itself.
 *
 * FAILS CLOSED ON ORIGIN. The grammar above already refuses the spellings that
 * escape, but a deep link reaches this without passing the server, and the shell
 * shows the verified badge over whatever it loads. So the resolved origin is
 * checked here too, and anything that leaves `startUrl`'s origin — or does not
 * parse — opens the mini app's own start page instead. Only the origin is
 * checked, never the path: which pages exist is the mini app's business.
 */
export function resolveMiniAppUrl(startUrl: string, path: string | undefined): string {
  if (!path) return startUrl;
  try {
    const base = new URL(startUrl);
    const resolved = new URL(path, base);
    return resolved.origin === base.origin ? resolved.toString() : startUrl;
  } catch {
    return startUrl;
  }
}
