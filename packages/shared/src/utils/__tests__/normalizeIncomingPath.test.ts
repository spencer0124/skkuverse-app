import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeIncomingPath, parseIncomingLink } from '../normalizeIncomingPath';

describe('normalizeIncomingPath', () => {
  describe('try-branch (URL constructor succeeds)', () => {
    it('passes through bare /', () => {
      expect(normalizeIncomingPath('/')).toBe('/');
    });

    it('normalizes empty path (bare scheme) to /', () => {
      expect(normalizeIncomingPath('skkuverse://')).toBe('/');
    });

    it('folds a host-only custom scheme into the path', () => {
      // Was asserted as '/' — that WAS the bug. `skkuverse:` is a non-special
      // scheme, so "random-junk" parses as the authority and the path came out
      // empty. The whitelist still sends this one home, exactly as it already
      // does for the triple-slash spelling below.
      expect(normalizeIncomingPath('skkuverse://random-junk')).toBe('/random-junk');
    });

    it('strips /p/ prefix from triple-slash custom scheme (bug 2 fix)', () => {
      expect(normalizeIncomingPath('skkuverse:///p/notices/skku-edu-undergrad/216916')).toBe(
        '/notices/skku-edu-undergrad/216916',
      );
    });

    it('strips /p/ prefix from universal-link form', () => {
      expect(normalizeIncomingPath('https://skkuverse.com/p/notices/cse/5847')).toBe(
        '/notices/cse/5847',
      );
    });

    it('strips /p/ prefix from path-only input (warm-start form)', () => {
      expect(normalizeIncomingPath('/p/notices/cse/5847')).toBe('/notices/cse/5847');
    });

    it('strips /p/ prefix from short paths', () => {
      expect(normalizeIncomingPath('/p/search')).toBe('/search');
    });

    it('strips query string', () => {
      expect(normalizeIncomingPath('/notices/cse/5847?foo=bar')).toBe('/notices/cse/5847');
    });

    it('strips fragment', () => {
      expect(normalizeIncomingPath('/notices/cse/5847#section')).toBe('/notices/cse/5847');
    });

    it('passes through triple-slash garbage path (whitelist fallback fires downstream)', () => {
      expect(normalizeIncomingPath('skkuverse:///random-junk')).toBe('/random-junk');
    });

    it('prefixes leading slash to relative-looking input', () => {
      // URL constructor with base gives pathname="/garbage-not-a-path"
      expect(normalizeIncomingPath('garbage-not-a-path')).toBe('/garbage-not-a-path');
    });
  });

  describe('catch-branch fallback (URL constructor throws)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('strips query and fragment when URL throws', () => {
      // Force the catch branch by stubbing URL to throw.
      vi.stubGlobal(
        'URL',
        class {
          constructor() {
            throw new TypeError('forced for catch-branch coverage');
          }
        },
      );
      expect(normalizeIncomingPath('/notices/cse/5847?foo=bar')).toBe('/notices/cse/5847');
      expect(normalizeIncomingPath('/notices/cse/5847#frag')).toBe('/notices/cse/5847');
      expect(normalizeIncomingPath('/notices/cse/5847?q=1#frag')).toBe('/notices/cse/5847');
    });

    it('prefixes leading slash and strips /p/ in fallback', () => {
      vi.stubGlobal(
        'URL',
        class {
          constructor() {
            throw new TypeError('forced for catch-branch coverage');
          }
        },
      );
      expect(normalizeIncomingPath('p/notices/cse/5847')).toBe('/notices/cse/5847');
    });
  });
});

/**
 * The authority fold. Every expectation below was verified against
 * `whatwg-url-without-unicode` — the implementation Expo installs as the runtime
 * `URL` — not just Node, because that is what actually parses these on device.
 */
describe('parseIncomingLink — custom-scheme authority', () => {
  it('recovers the path and query from the double-slash form', () => {
    const { pathname, params } = parseIncomingLink('skkuverse://map?place=nsc-plaza-a3');
    expect(pathname).toBe('/map');
    expect(params.get('place')).toBe('nsc-plaza-a3');
  });

  it('treats the triple-slash spelling identically', () => {
    const { pathname, params } = parseIncomingLink('skkuverse:///map?place=nsc-plaza-a3');
    expect(pathname).toBe('/map');
    expect(params.get('place')).toBe('nsc-plaza-a3');
  });

  it('lowercases the folded host but preserves path case', () => {
    // Opaque hosts are NOT lowercased by the parser, so a capitalised link from a
    // poster or QR code would otherwise miss the whitelist. Path case must
    // survive, though — mini-app slugs are case-sensitive.
    expect(parseIncomingLink('skkuverse://MAP/HSSC').pathname).toBe('/map/HSSC');
  });

  it('strips a port, which lives on host but not hostname', () => {
    expect(parseIncomingLink('skkuverse://map:8080/x').pathname).toBe('/map/x');
  });

  it('handles the slashless form an Android intent can produce', () => {
    // hostname "", pathname "map" — no leading slash to rely on.
    const { pathname, params } = parseIncomingLink('skkuverse:map?place=x');
    expect(pathname).toBe('/map');
    expect(params.get('place')).toBe('x');
  });

  it('sends an empty authority and path home while keeping the query', () => {
    const { pathname, params } = parseIncomingLink('skkuverse://?place=x');
    expect(pathname).toBe('/');
    expect(params.get('place')).toBe('x');
  });

  it('never folds an http host, which is a real domain', () => {
    // Folding here would turn an attacker's domain into a route segment.
    const { pathname, params } = parseIncomingLink('https://evil.com/map?place=x');
    expect(pathname).toBe('/map');
    expect(params.get('place')).toBe('x');
  });

  it('strips /p/ and keeps the query on the universal-link form', () => {
    const { pathname, params } = parseIncomingLink('https://skkuverse.com/p/map?place=x');
    expect(pathname).toBe('/map');
    expect(params.get('place')).toBe('x');
  });

  it('does not fold the relative base authority into the path', () => {
    // The relative form is parsed against `skkuverse://app`, so a naive fold
    // would prepend "/app" to every warm-start pathname.
    expect(parseIncomingLink('/p/notices/cse/5847').pathname).toBe('/notices/cse/5847');
    expect(parseIncomingLink('/map').pathname).toBe('/map');
  });

  it('repairs the other schemes this defect had silently broken', () => {
    expect(parseIncomingLink('skkuverse://search').pathname).toBe('/search');
    expect(parseIncomingLink('skkuverse://campus').pathname).toBe('/campus');
    expect(parseIncomingLink('skkuverse://map/hssc').pathname).toBe('/map/hssc');
    expect(parseIncomingLink('skkuverse://m/skkuw').pathname).toBe('/m/skkuw');
    expect(parseIncomingLink('skkuverse://notices/cse/5847').pathname).toBe('/notices/cse/5847');
  });

  it('returns empty params rather than undefined when there is no query', () => {
    expect(parseIncomingLink('/campus').params.get('place')).toBeNull();
  });
});
