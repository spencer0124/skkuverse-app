/**
 * The mini-app shell's message dispatcher: one page message in, at most one
 * effect out.
 *
 * The contract is the miniapp protocol (`@skkuverse/miniapp/protocol`, source
 * of truth in skkuverse-miniapp). Every message goes through its `parseMessage`
 * first; anything that does not parse is dropped without a word. Then:
 *
 *   - A request (it carries an `id`) always gets exactly one response, so a
 *     page never waits out a timeout. `denied` when the posting origin has no
 *     grant, `unsupported` otherwise — the protocol defines no request method
 *     yet, so the first one is a case added here.
 *   - A notification runs only when the posting origin is granted that method,
 *     and is dropped silently otherwise. It has no answer either way.
 *
 * The grant comes from the caller (`resolveMiniAppCapabilities` over
 * `event.nativeEvent.url`, per message), never from whoever opened the screen:
 * a webview navigates, and what was granted at open time would outlive the
 * origin it was granted to.
 *
 * Every effect is injected, which keeps this free of relative and React Native
 * imports so `node --experimental-strip-types --test` can drive it.
 */
import {
  parseMessage,
  type HapticStyle,
  type HostMessage,
  type ShellPatch,
} from '@skkuverse/miniapp/protocol';

export interface MiniAppEffects {
  haptic(style: HapticStyle): void;
  /** Leave the page: `appUrl` first when set, else `url`. */
  openLink(target: { url: string; appUrl?: string }): void;
  /** A place or another mini-app, through the app's own action dispatcher. */
  performAction(actionType: 'map' | 'miniapp', actionValue: string): void;
  track(event: string, params?: Record<string, unknown>): void;
  ready(): void;
  setShell(patch: ShellPatch): void;
  /** Deliver to the page on `origin` (`hostDeliverScript`). */
  deliver(origin: string, message: HostMessage): void;
}

export interface PageEvent {
  /** `event.nativeEvent.data`. */
  data: unknown;
  /** `event.nativeEvent.url`: the document that posted. */
  url: string | undefined;
}

/** What happened to a message, for tests and debug logging. */
export type DispatchOutcome = 'dropped' | 'denied' | 'unsupported' | 'handled';

/** The origin of `url`, or null when it has none a response could be sent to. */
export function pageOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/**
 * @param granted The methods the posting document may use, resolved per
 *   message from `event.url` (`resolveMiniAppCapabilities`). Empty means none.
 */
export function dispatchMiniAppMessage(
  event: PageEvent,
  granted: readonly string[],
  effects: MiniAppEffects,
): DispatchOutcome {
  const msg = parseMessage(event.data);
  if (!msg) return 'dropped';

  if (msg.id !== undefined) {
    // A response goes back only to the origin that asked. With no usable
    // origin there is nowhere safe to send one, and `hostDeliverScript`
    // re-checks it in the page anyway.
    const origin = pageOrigin(event.url);
    const code = granted.length === 0 ? 'denied' : 'unsupported';
    if (origin) {
      effects.deliver(origin, {
        id: msg.id,
        ok: false,
        error: {
          code,
          message:
            code === 'denied'
              ? 'This page is not granted the skkuverse bridge.'
              : `Unknown method: ${msg.method}`,
        },
      });
    }
    return code;
  }

  if (!granted.includes(msg.method)) return 'dropped';

  switch (msg.method) {
    case 'haptic.impact':
      effects.haptic(msg.params.style);
      break;
    case 'link.open':
      effects.openLink(msg.params);
      break;
    case 'map.openPlace':
      effects.performAction('map', msg.params.place);
      break;
    case 'miniapp.open':
      effects.performAction('miniapp', msg.params.target);
      break;
    case 'analytics.track':
      effects.track(msg.params.event, msg.params.params);
      break;
    case 'app.ready':
      effects.ready();
      break;
    case 'shell.set':
      effects.setShell(msg.params);
      break;
    default:
      // A method the protocol parses but this build does not handle yet. Only
      // reachable if `granted` lists more than this switch covers.
      return 'dropped';
  }
  return 'handled';
}
