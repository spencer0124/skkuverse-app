import { describe, it, expect } from 'vitest';
import { resolveInitialTabRouteName } from '../resolveInitialTabRoute';

describe('resolveInitialTabRouteName', () => {
  it("maps 'home' to expo-router 'index' route name", () => {
    expect(resolveInitialTabRouteName('home')).toBe('index');
  });

  it.each(['campus', 'transit', 'notices'] as const)(
    "passes through valid tab name '%s'",
    (tab) => {
      expect(resolveInitialTabRouteName(tab)).toBe(tab);
    },
  );

  it("falls back to 'index' for unknown string values", () => {
    expect(resolveInitialTabRouteName('invalid')).toBe('index');
    expect(resolveInitialTabRouteName('')).toBe('index');
    expect(resolveInitialTabRouteName('Home')).toBe('index'); // case-sensitive
  });

  it("falls back to 'index' for undefined / null (fresh install)", () => {
    expect(resolveInitialTabRouteName(undefined)).toBe('index');
    expect(resolveInitialTabRouteName(null)).toBe('index');
  });

  it("falls back to 'index' for non-string types (corrupt MMKV)", () => {
    expect(resolveInitialTabRouteName(0)).toBe('index');
    expect(resolveInitialTabRouteName({})).toBe('index');
    expect(resolveInitialTabRouteName([])).toBe('index');
  });
});
