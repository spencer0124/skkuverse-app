import { describe, it, expect } from 'vitest';
import { parseMiniAppTarget, resolveMiniAppUrl } from '../target';

/**
 * The cases that matter are the ones that would let the shell frame a page on a
 * host nobody registered — the shell shows the verified badge over whatever it
 * loads, so a path that escapes the origin is the failure this file exists for.
 */

describe('parseMiniAppTarget', () => {
  it.each([
    ['eskara-2026', { id: 'eskara-2026' }],
    ['eskara-2026/eskara/wristband', { id: 'eskara-2026', path: '/eskara/wristband' }],
    ['eskara-2026/eskara/lineup?day=2', { id: 'eskara-2026', path: '/eskara/lineup?day=2' }],
  ])('parses %s', (value, expected) => {
    expect(parseMiniAppTarget(value)).toEqual(expected);
  });

  it.each([
    ['a protocol-relative path', 'eskara-2026//evil.com/x'],
    ['a backslash authority', 'eskara-2026/\\evil.com'],
    ['a trailing newline', 'eskara-2026/eskara\n'],
    ['an inner space', 'eskara-2026/a b'],
    ['an absolute URL', 'https://eskara.miniapp.skkuverse.com/eskara'],
    ['a leading slash', '/eskara-2026/x'],
    ['an uppercase id', 'Eskara-2026'],
    ['an empty string', ''],
    ['a non-string', 42],
  ])('refuses %s', (_label, value) => {
    expect(parseMiniAppTarget(value)).toBeNull();
  });
});

describe('resolveMiniAppUrl', () => {
  const START = 'https://eskara.miniapp.skkuverse.com/eskara';

  it('opens startUrl when there is no path', () => {
    expect(resolveMiniAppUrl(START, undefined)).toBe(START);
    expect(resolveMiniAppUrl(START, '')).toBe(START);
  });

  it('resolves a path on the registered origin', () => {
    expect(resolveMiniAppUrl(START, '/eskara/wristband')).toBe(
      'https://eskara.miniapp.skkuverse.com/eskara/wristband',
    );
  });

  it('carries a query and a fragment through', () => {
    expect(resolveMiniAppUrl(START, '/eskara/lineup?day=2#top')).toBe(
      'https://eskara.miniapp.skkuverse.com/eskara/lineup?day=2#top',
    );
  });

  it.each([
    ['a protocol-relative path', '//evil.com/x'],
    ['a backslash authority', '/\\evil.com'],
    ['an absolute URL on another origin', 'https://evil.com/eskara'],
    ['a scheme change on the same host', 'http://eskara.miniapp.skkuverse.com/eskara'],
  ])('falls back to startUrl for %s', (_label, path) => {
    expect(resolveMiniAppUrl(START, path)).toBe(START);
  });

  it('keeps an absolute URL that stays on the registered origin', () => {
    // Not something the grammar produces, but the origin rule — not the spelling
    // — is what this function is responsible for.
    expect(resolveMiniAppUrl(START, 'https://eskara.miniapp.skkuverse.com/eskara/x')).toBe(
      'https://eskara.miniapp.skkuverse.com/eskara/x',
    );
  });

  it('falls back to startUrl when startUrl itself does not parse', () => {
    expect(resolveMiniAppUrl('not a url', '/x')).toBe('not a url');
  });
});
