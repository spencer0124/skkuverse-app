/**
 * What a notification tap should do — decided here, performed by the caller.
 *
 * Pure on purpose. The app-side router (`apps/mobile/src/services/notification-router.ts`)
 * imports `expo-router` and can only run inside a mounted React tree; this file
 * has no such dependency, so the decision is unit-testable and identical for
 * every entry point (quit-state launch, warm tap, foreground notifee press,
 * background notifee press).
 *
 * The wire contract is `docs/reference/miniapp-notification-payload.md`.
 * Surface 2 of that document is the FCM `data` map this reads. FCM v1 validates
 * every `data` value as a string, so nothing here may assume a richer type —
 * hence the `typeof x === 'string'` narrowing on every field.
 */

import { parseActionType } from '../types/sdui';

/**
 * The FCM `data` map, as far as this module cares.
 *
 * `notificationId` is deliberately absent: it exists so the server can prove
 * after the fact that the feed entry and the delivery agree, and the device has
 * no use for it. Adding it here would imply the app does something with it.
 */
export interface NotificationTapData {
  type?: string;
  // notice
  sourceId?: string;
  articleNo?: string;
  // mini app
  miniAppId?: string;
  actionType?: string;
  actionValue?: string;
}

/**
 * Action types this build can actually navigate to.
 *
 * `content` is prose rendered in place by whichever sheet owns the button, and
 * `miniapp` is deferred until its value shape is settled (`eventmap-rendering.md`
 * §7.3 — the event-map parser validates it as an HTTPS URL while
 * `openMiniAppById` takes a registry slug, and guessing freezes the wrong one
 * into a binary). `unknown` is what an unrecognised value parses to.
 */
const NAVIGABLE_ACTION_TYPES = ['route', 'webview', 'external'] as const;

export type NavigableActionType = (typeof NAVIGABLE_ACTION_TYPES)[number];

export type NotificationTap =
  | { kind: 'notice'; sourceId: string; articleNo: string }
  | { kind: 'sdui-action'; actionType: NavigableActionType; actionValue: string }
  | { kind: 'miniapp'; id: string }
  | null;

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asNavigable(raw: unknown): NavigableActionType | null {
  const parsed = parseActionType(raw);
  return (NAVIGABLE_ACTION_TYPES as readonly string[]).includes(parsed)
    ? (parsed as NavigableActionType)
    : null;
}

/**
 * `webview` and `external` must carry an https URL.
 *
 * `handleSduiAction` sends both to `openWebView`, whose `normalizeWebUrl` hands
 * anything non-web to `Linking.openURL` — so without this check a payload could
 * make the device open `itms-apps:`, `tel:` or any custom scheme, which is the
 * "uninterpreted string reaches a URL opener" failure `parseActionType`'s
 * `unknown` sentinel exists to prevent. A notification is the one surface where
 * that string is fully attacker-shaped if the send key ever leaks.
 *
 * This is not a new rule: the event-map parser already gates the same two action
 * types on the same condition (`isValidActionValue` in `eventmap/parser.ts`), so
 * a notification payload and a map button now agree about what a `webview` is.
 * A rejected value falls back to the mini app rather than doing nothing.
 */
function isAcceptableValue(actionType: NavigableActionType, value: string): boolean {
  if (actionType === 'route') return value.startsWith('/');
  return value.startsWith('https://') && !/\s/.test(value);
}

/**
 * `null` means "this payload asks for no navigation" — the banner still showed,
 * the tap simply does nothing, and nothing throws.
 */
export function resolveNotificationTap(data: NotificationTapData | undefined): NotificationTap {
  const type = asNonEmptyString(data?.type);
  if (!type || !data) return null;

  switch (type) {
    case 'notice': {
      const sourceId = asNonEmptyString(data.sourceId);
      const articleNo = asNonEmptyString(data.articleNo);
      if (!sourceId || !articleNo) return null;
      return { kind: 'notice', sourceId, articleNo };
    }

    case 'miniapp': {
      // A target the payload named AND this build knows how to reach.
      const actionType = asNavigable(data.actionType);
      const actionValue = asNonEmptyString(data.actionValue);
      if (actionType && actionValue && isAcceptableValue(actionType, actionValue)) {
        return { kind: 'sdui-action', actionType, actionValue };
      }

      // Everything else lands on the mini app itself, by id: no target given,
      // a target this build cannot navigate (`content`/`miniapp`), a newer
      // build's action type (`unknown`), an empty value, or a value whose shape
      // the action type does not accept.
      //
      // The contract's original wording said an unrecognised type degrades to a
      // no-op. The property that protected is "never open an arbitrary string",
      // and a registry-resolved id cannot be one — the consumer looks it up via
      // `GET /miniapps/:id` and drops it silently on a miss. A dead tap during a
      // festival is a worse outcome than landing one screen up, so the fallback
      // is deliberate and is recorded in the contract document.
      const id = asNonEmptyString(data.miniAppId);
      return id ? { kind: 'miniapp', id } : null;
    }

    default:
      // Includes 'eventmap-refresh', which is silent and never produces a tap.
      // A branch for it here would be unreachable by construction.
      return null;
  }
}
