/**
 * Which actions a first-party PAGE may ask the app to perform (`web:action`).
 *
 * A page sends an action in the same `actionType`/`actionValue` shape a server
 * button or a push uses, but it gets a strict subset of what those may do. The
 * action union was built for values the SERVER authored; a page is a different
 * trust level, because a page is anything that page's host ever serves.
 *
 *   map      a place on the campus map, `[<kind>:]<placeId>` (parseMapPlaceRef)
 *   miniapp  a registered mini app, `<id>[/path]` (parseMiniAppTarget), held to
 *            that mini app's registered origin by the shell
 *
 * Deliberately NOT allowed, and the reason is the same for each: the value
 * would name a destination rather than a thing.
 *
 *   route             `router.push(anything)` — every screen the app registers,
 *                     debug screens and `/webview?url=<anything>` included.
 *                     The same hole `web:navigate` was removed for.
 *   webview/external  any URL. A page already has `web:open-url` for its own
 *                     outbound links.
 *   content/unknown   nothing to do.
 *
 * Both allowed grammars are anchored regexes over ids, so a page can never name
 * a route or a URL through this channel — only a place or a mini app, which
 * the app then resolves itself. The origin gate in front of this (the server's
 * `bridgeOrigins`) decides WHO may ask; this decides WHAT they may ask for.
 */
import { parseMiniAppTarget } from '../miniapps/target';
import { parseMapPlaceRef } from '../map/place-ref';

export const WEB_ACTION_TYPES = ['map', 'miniapp'] as const;

export type WebActionType = (typeof WEB_ACTION_TYPES)[number];

export interface WebAction {
  actionType: WebActionType;
  actionValue: string;
}

/** The action to dispatch, or null when a page may not ask for it. */
export function resolveWebAction(actionType: unknown, actionValue: unknown): WebAction | null {
  if (typeof actionValue !== 'string') return null;
  switch (actionType) {
    case 'map':
      return parseMapPlaceRef(actionValue) ? { actionType, actionValue } : null;
    case 'miniapp':
      return parseMiniAppTarget(actionValue) ? { actionType, actionValue } : null;
    default:
      return null;
  }
}

/**
 * Feature detection for pages, injected before content loads.
 *
 * Pages render an action button only when the host lists the action here, so an
 * app too old to handle `web:action` — every released build before this one —
 * never shows a button that does nothing. It advertises; it does not grant. A
 * page on an origin outside `bridgeOrigins` sees the same list and is still
 * refused per message, so nothing here is a secret.
 */
export const WEB_BRIDGE_ADVERTISEMENT_JS = `(function () {
  var host = window.skkuverse || (window.skkuverse = {});
  host.bridge = Object.freeze({ actions: Object.freeze(${JSON.stringify(WEB_ACTION_TYPES)}) });
})();
true;`;
