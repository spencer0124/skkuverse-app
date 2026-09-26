import { describe, it, expect } from 'vitest';
import { resolveWebAction, WEB_BRIDGE_ADVERTISEMENT_JS } from '../web-action';

/**
 * A first-party page is a different trust level from the server: it is anything
 * its host ever serves. The cases that matter are the ones that would let a page
 * name a destination — a route or a URL — instead of a place or a mini app.
 */

describe('resolveWebAction', () => {
  it.each([
    ['map', 'event:eskara-2026-wristband-guest'],
    ['map', 'skku_building:31'],
    ['miniapp', 'eskara-2026/eskara/wristband'],
    ['miniapp', 'eskara-2026'],
  ])('allows %s %s', (actionType, actionValue) => {
    expect(resolveWebAction(actionType, actionValue)).toEqual({ actionType, actionValue });
  });

  it.each([
    ['route to any screen', 'route', '/settings/debug-logs'],
    ['route to an arbitrary web view', 'route', '/webview?url=https://evil.com'],
    ['webview', 'webview', 'https://evil.com'],
    ['external', 'external', 'https://evil.com'],
    ['content', 'content', 'text'],
    ['an unknown type', 'teleport', 'x'],
    ['the legacy url alias', 'url', 'https://evil.com'],
  ])('refuses %s', (_label, actionType, actionValue) => {
    expect(resolveWebAction(actionType, actionValue)).toBeNull();
  });

  it.each([
    ['a map path traversal', 'map', '../x'],
    ['a map URL', 'map', 'https://evil.com'],
    ['a map unknown kind', 'map', 'stage:main'],
    ['a miniapp escaping its origin', 'miniapp', 'eskara-2026//evil.com'],
    ['a miniapp URL', 'miniapp', 'https://evil.com'],
    ['a non-string value', 'map', 31],
  ])('refuses %s', (_label, actionType, actionValue) => {
    expect(resolveWebAction(actionType, actionValue)).toBeNull();
  });
});

describe('WEB_BRIDGE_ADVERTISEMENT_JS', () => {
  it('advertises exactly the allowed actions, frozen', () => {
    const win: { skkuverse?: { bridge?: { actions?: readonly string[] } } } = {};
    new Function('window', WEB_BRIDGE_ADVERTISEMENT_JS)(win);
    expect(win.skkuverse?.bridge?.actions).toEqual(['map', 'miniapp']);
    expect(Object.isFrozen(win.skkuverse?.bridge?.actions)).toBe(true);
  });
});
