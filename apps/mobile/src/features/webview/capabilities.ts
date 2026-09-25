/**
 * Origin gate for the bridge, shared by both web shells: the generic /webview,
 * which speaks `@skkuverse/bridge`, and the /mini-app shell, which speaks the
 * miniapp protocol (`@skkuverse/miniapp/protocol`). One origin match
 * (`bridgedOrigin`), two message sets.
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
 * Kept free of relative and React Native imports (the bridge import is
 * `import type`, erased at runtime; the miniapp protocol is a plain ESM
 * package) so `node --experimental-strip-types --test` can exercise it without
 * a Metro resolver. The caller supplies
 * `allowedOrigins`; it is required rather than defaulted so no call site can
 * accidentally omit the gate and get a permissive fallback.
 */
import type { WebToAppMessage } from '@skkuverse/bridge';
import { NOTIFY_METHODS, type NotifyMethod } from '@skkuverse/miniapp/protocol';

export type WebMessageType = WebToAppMessage['type'];

/**
 * Messages a first-party page may send.
 *
 * Only what skkuverse-web's `apps/webview/src/bridge.ts` actually posts (the SPA
 * moved to that repo; see umbrella ADR 0005). `web:navigate` is
 * deliberately ABSENT: our SPA has never sent it, yet the old handler ran
 * `router.push(msg.path)` on it unconditionally — an unguarded navigation sink
 * kept safe only by the fact that nothing untrusted had reached the screen yet.
 * Rerouting notice links here is precisely what would have ended that, so it
 * goes. Re-add it only alongside a path allowlist.
 *
 * `web:action` is NOT that hole reopened. It carries an action, not a path, and
 * the only actions a page may ask for are `map` and `miniapp`, whose values are
 * ids the app resolves itself (`resolveWebAction` in @skkuverse/shared). A page
 * can name a place or a mini app through it, never a route or a URL.
 *
 * `web:haptic` plays one impact from a fixed set of three styles — the setlist
 * mini app's counter uses it. It can buzz the phone and nothing else.
 */
export const FIRST_PARTY_CAPABILITIES: readonly WebMessageType[] = [
  'web:open-url',
  'web:map-select',
  'web:action',
  'web:haptic',
];

/** No capabilities. */
const NONE: readonly WebMessageType[] = [];
const NO_METHODS: readonly NotifyMethod[] = [];

/**
 * The origin of `pageUrl` when it is on the allowlist, else null.
 *
 * The one origin match both shells run: `/webview` turns it into the
 * `@skkuverse/bridge` message set, `/mini-app` into the miniapp protocol's.
 *
 * @param pageUrl `event.nativeEvent.url` — the URL of the document that posted.
 * @param allowedOrigins Server-owned allowlist (`getBridgeOrigins()`).
 */
export function bridgedOrigin(
  pageUrl: string | undefined,
  allowedOrigins: readonly string[],
): string | null {
  if (!pageUrl || allowedOrigins.length === 0) return null;
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return null;
  }
  // `new URL().origin` yields the STRING "null" for opaque origins (data:,
  // sandboxed frames). Never let that match an allowlist entry.
  if (origin === 'null') return null;
  return allowedOrigins.includes(origin) ? origin : null;
}

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
  return bridgedOrigin(pageUrl, allowedOrigins) ? FIRST_PARTY_CAPABILITIES : NONE;
}

/**
 * Miniapp protocol methods granted to a document loaded from `pageUrl`: every
 * notify method on an allowlisted origin, nothing anywhere else.
 *
 * All or nothing because the curated phase has one trust level — a bridged
 * origin is ours. Scoping a third-party mini-app to part of the set (ADR 0006
 * decision 4) is a per-origin grant table in place of `NOTIFY_METHODS` here.
 */
export function resolveMiniAppCapabilities(
  pageUrl: string | undefined,
  allowedOrigins: readonly string[],
): readonly NotifyMethod[] {
  return bridgedOrigin(pageUrl, allowedOrigins) ? NOTIFY_METHODS : NO_METHODS;
}
