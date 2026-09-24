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

/**
 * Payload checks, per type, for the messages whose fields reach a decision.
 *
 * Everything else is still cast after the `type` check, as it always was. A
 * message a handler acts on should not be one field short of a crash, and a
 * `web:action` is one — its fields are handed to an allowlist that expects
 * strings.
 */
function hasValidPayload(parsed: Record<string, unknown>): boolean {
  if (parsed.type === 'web:action') {
    return (
      typeof parsed.actionType === 'string' &&
      parsed.actionType !== '' &&
      typeof parsed.actionValue === 'string' &&
      parsed.actionValue !== ''
    );
  }
  return true;
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
