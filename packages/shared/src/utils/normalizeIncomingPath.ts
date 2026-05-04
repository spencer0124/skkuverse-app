/**
 * Normalize an incoming deep-link string to a clean pathname.
 *
 * Per Expo native-intent docs: "While the parameter is called `path` there is
 * no guarantee that this is a path or a valid URL." Cold-start hands the
 * launch URL ("skkuverse:///p/notices/x/y"); warm-start hands the parsed
 * pathname ("/p/notices/x/y"). `new URL(input, base)` handles both forms,
 * triple-slash empty-host form, query strings, and fragments uniformly.
 *
 * - empty pathname (e.g. "skkuverse://" or "skkuverse://host-only") → "/"
 * - "/p/<rest>" → "/<rest>"   (universal-link namespace strip)
 *
 * Used by apps/mobile/app/+native-intent.tsx redirectSystemPath. Pure +
 * vitest-testable here; co-located with resolveInitialTabRouteName.
 */
export function normalizeIncomingPath(rawPath: string): string {
  let pathname: string;
  try {
    pathname = new URL(rawPath, 'skkuverse://app').pathname;
  } catch {
    pathname = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
    const qIndex = pathname.indexOf('?');
    if (qIndex !== -1) pathname = pathname.substring(0, qIndex);
    const hashIndex = pathname.indexOf('#');
    if (hashIndex !== -1) pathname = pathname.substring(0, hashIndex);
  }
  if (pathname === '') pathname = '/';
  if (pathname.startsWith('/p/')) pathname = pathname.substring(2);
  return pathname;
}
