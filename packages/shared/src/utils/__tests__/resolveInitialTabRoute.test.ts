import { describe, it, expect } from 'vitest';
import { resolveInitialTabRouteName } from '../resolveInitialTabRoute';

describe('resolveInitialTabRouteName', () => {
  it.each(['home', 'campus', 'transit', 'notices'] as const)(
    "passes through valid tab name '%s'",
    (tab) => {
      expect(resolveInitialTabRouteName(tab)).toBe(tab);
    },
  );

  it("falls back to 'home' for unknown string values", () => {
    expect(resolveInitialTabRouteName('invalid')).toBe('home');
    expect(resolveInitialTabRouteName('')).toBe('home');
    expect(resolveInitialTabRouteName('Home')).toBe('home'); // case-sensitive
  });

  it("falls back to 'home' for undefined / null (fresh install)", () => {
    expect(resolveInitialTabRouteName(undefined)).toBe('home');
    expect(resolveInitialTabRouteName(null)).toBe('home');
  });

  it("falls back to 'home' for non-string types (corrupt MMKV)", () => {
    expect(resolveInitialTabRouteName(0)).toBe('home');
    expect(resolveInitialTabRouteName({})).toBe('home');
    expect(resolveInitialTabRouteName([])).toBe('home');
  });
});
