/**
 * Origin gate for the generic /webview shell.
 *
 * The shell loads two very different kinds of page through one component:
 *
 *   - first-party SPA pages (분실물, bus info) that legitimately drive the app
 *     via `@skkuverse/bridge`
 *   - arbitrary external pages (notice originals, links inside notice markdown,
 *     SDUI `external`) that must not be able to drive anything
 *
 * The capability set is therefore resolved from the LOADED DOCUMENT'S ORIGIN,
 * never from whoever opened the screen. Two reasons the caller can't be trusted
 * with this decision:
 *
 *   1. A webview navigates. Open a notice source page, let it link onward, and
 *      a grant made at open time is live on an origin nobody vetted. So the
 *      check runs per message, against `event.nativeEvent.url`.
 *   2. The allowlist is server-owned (`GET /app/config` → `webview.bridgeOrigins`).
 *      A caller-supplied capability prop would be a second, stale source of truth.
 *
 * FAILS CLOSED. No config fetched yet, fetch failed, unparseable URL, unmatched
 * origin → `[]`, and `onMessage` drops everything. Failing closed costs 분실물
 * its `web:open-url` on a cold offline start; failing open costs
 * `Linking.openURL` to any page in the app.
 *
 * Caveat this file cannot fix: on Android a child iframe can post to the bridge,
 * and `nativeEvent.url` reports the TOP-LEVEL document, not the frame that sent
 * the message. A first-party page embedding untrusted iframes would leak its
 * grant to them. Today the only bridged origin is our own SPA, which embeds
 * none — but that is an invariant of the allowlist, not of this code, which is
 * why adding an origin to BRIDGE_ORIGINS is flagged server-side as a trust
 * decision.
 *
 * Kept dependency-free (the one import is `import type`, erased at runtime) so
 * `node --experimental-strip-types --test` can exercise it without a Metro
 * resolver — same arrangement as `mini-app/protocol.ts`. The caller supplies
 * `allowedOrigins`; it is required rather than defaulted so no call site can
 * accidentally omit the gate and get a permissive fallback.
 */
import type { WebToAppMessage } from '@skkuverse/bridge';

export type WebMessageType = WebToAppMessage['type'];

/**
 * Messages a first-party page may send.
 *
 * Only what `apps/webview/src/bridge.ts` actually posts. `web:navigate` is
 * deliberately ABSENT: our SPA has never sent it, yet the old handler ran
 * `router.push(msg.path)` on it unconditionally — an unguarded navigation sink
 * kept safe only by the fact that nothing untrusted had reached the screen yet.
 * Rerouting notice links here is precisely what would have ended that, so it
 * goes. Re-add it only alongside a path allowlist.
 */
export const FIRST_PARTY_CAPABILITIES: readonly WebMessageType[] = [
  'web:open-url',
  'web:map-select',
];

/** No capabilities. */
const NONE: readonly WebMessageType[] = [];

/**
 * Capabilities granted to a document loaded from `pageUrl`.
 *
 * @param pageUrl `event.nativeEvent.url` — the URL of the document that posted.
 * @param allowedOrigins Server-owned allowlist (`getBridgeOrigins()`).
 */
export function resolveWebviewCapabilities(
  pageUrl: string | undefined,
  allowedOrigins: readonly string[],
): readonly WebMessageType[] {
  if (!pageUrl || allowedOrigins.length === 0) return NONE;
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return NONE;
  }
  // `new URL().origin` yields the STRING "null" for opaque origins (data:,
  // sandboxed frames). Never let that match an allowlist entry.
  if (origin === 'null') return NONE;
  return allowedOrigins.includes(origin) ? FIRST_PARTY_CAPABILITIES : NONE;
}
