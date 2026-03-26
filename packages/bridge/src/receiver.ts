import type { AppToWebMessage } from './types';

const VALID_TYPES = new Set([
  'app:auth-token',
  'app:navigate',
  'app:theme-changed',
  'app:locale-changed',
]);

/**
 * Safely parse a raw string from WebView's `onMessage` into a typed message.
 * Returns `null` for malformed or unknown messages.
 */
export function parseWebMessage(raw: string): AppToWebMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.type === 'string' &&
      VALID_TYPES.has(parsed.type)
    ) {
      return parsed as AppToWebMessage;
    }
    return null;
  } catch {
    return null;
  }
}
