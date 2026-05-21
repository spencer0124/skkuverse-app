import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeIncomingPath } from '../normalizeIncomingPath';

describe('normalizeIncomingPath', () => {
  describe('try-branch (URL constructor succeeds)', () => {
    it('passes through bare /', () => {
      expect(normalizeIncomingPath('/')).toBe('/');
    });

    it('normalizes empty path (bare scheme) to /', () => {
      expect(normalizeIncomingPath('skkuverse://')).toBe('/');
    });

    it('normalizes host-only custom scheme to /', () => {
      // host="random-junk", pathname=""; bare-/ branch will fire downstream
      expect(normalizeIncomingPath('skkuverse://random-junk')).toBe('/');
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
