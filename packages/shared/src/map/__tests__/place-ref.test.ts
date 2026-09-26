import { describe, it, expect } from 'vitest';
import { parseMapPlaceRef } from '../place-ref';

describe('parseMapPlaceRef', () => {
  it.each([
    ['event:eskara-2026-wristband-guest', { kind: 'event', placeId: 'eskara-2026-wristband-guest' }],
    ['skku_building:31', { kind: 'skku_building', placeId: '31' }],
    ['eskara-2026-wristband-guest', { kind: null, placeId: 'eskara-2026-wristband-guest' }],
  ])('parses %s', (value, expected) => {
    expect(parseMapPlaceRef(value)).toEqual(expected);
  });

  it.each([
    ['an unknown kind', 'stage:main'],
    ['a path traversal', '../x'],
    ['a slash', 'event:a/b'],
    ['whitespace', 'event:a b'],
    ['a trailing newline', 'event:a\n'],
    ['an uppercase id', 'event:Wristband'],
    ['an empty string', ''],
    ['an empty id', 'event:'],
    ['a URL', 'https://evil.com'],
    ['a non-string', 31],
  ])('refuses %s', (_label, value) => {
    expect(parseMapPlaceRef(value)).toBeNull();
  });
});
