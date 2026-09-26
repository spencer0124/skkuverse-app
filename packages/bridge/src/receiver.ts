import type { WebToAppMessage } from './types';

const VALID_TYPES = new Set([
  'web:ready',
  'web:navigate',
  'web:analytics',
  'web:haptic',
  'web:open-url',
  'web:map-select',
  'web:action',
]);

const HAPTIC_STYLES = new Set(['light', 'medium', 'heavy']);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

/**
 * Payload checks, per type, for the messages whose fields reach a decision.
 *
 * Everything else is still cast after the `type` check, as it always was. A
 * message a handler acts on should not be one field short of a crash: a
 * `web:action`'s fields are handed to an allowlist that expects strings, a
 * `web:open-url`'s to `Linking.openURL`, and a `web:haptic`'s style picks the
 * impact to play.
 */
function hasValidPayload(parsed: Record<string, unknown>): boolean {
  switch (parsed.type) {
    case 'web:action':
      return isNonEmptyString(parsed.actionType) && isNonEmptyString(parsed.actionValue);
    case 'web:open-url':
      return isNonEmptyString(parsed.url) && (parsed.appUrl === undefined || isNonEmptyString(parsed.appUrl));
    case 'web:haptic':
      return typeof parsed.style === 'string' && HAPTIC_STYLES.has(parsed.style);
    default:
      return true;
  }
}

/**
 * Safely parse a raw string from WebView's `onMessage` into a typed message.
 * Returns `null` for malformed or unknown messages.
 */
export function parseWebMessage(raw: string): WebToAppMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.type === 'string' &&
      VALID_TYPES.has(parsed.type) &&
      hasValidPayload(parsed)
    ) {
      return parsed as WebToAppMessage;
    }
    return null;
  } catch {
    return null;
  }
}
