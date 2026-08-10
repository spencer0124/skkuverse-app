/**
 * `parseActionType` — why unknown must not mean 'external'.
 *
 * The old rule ("anything unrecognised is an external link") meant the failure
 * mode of not understanding an action was to hand it to a URL opener. A typo in
 * a server payload, or an action type newer than the installed build, would open
 * a browser at whatever string arrived. `'unknown'` gives that case somewhere to
 * land where `handleSduiAction` can do nothing with it.
 */

import { describe, it, expect } from 'vitest';
import { parseActionType } from '../sdui';

describe('parseActionType', () => {
  it.each(['content', 'route', 'webview', 'external', 'miniapp'] as const)(
    'passes the wire value %s through unchanged',
    (value) => {
      expect(parseActionType(value)).toBe(value);
    },
  );

  it('maps the legacy "url" spelling to external', () => {
    expect(parseActionType('url')).toBe('external');
  });

  it('returns unknown for an unrecognised value instead of opening a browser', () => {
    expect(parseActionType('garbage')).toBe('unknown');
  });

  it('returns unknown for an empty string', () => {
    expect(parseActionType('')).toBe('unknown');
  });

  it('returns unknown for a missing action type', () => {
    // Call sites do `raw.actionType as string`, so undefined does reach here.
    expect(parseActionType(undefined)).toBe('unknown');
  });

  it('returns unknown for a non-string, rather than coercing it', () => {
    expect(parseActionType(7)).toBe('unknown');
    expect(parseActionType({ actionType: 'route' })).toBe('unknown');
  });
});
