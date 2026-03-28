import type { WebToAppMessage } from './types';

const VALID_TYPES = new Set([
  'web:ready',
  'web:navigate',
  'web:analytics',
  'web:haptic',
  'web:open-url',
  'web:map-select',
]);

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
      VALID_TYPES.has(parsed.type)
    ) {
      return parsed as WebToAppMessage;
    }
    return null;
  } catch {
    return null;
  }
}
