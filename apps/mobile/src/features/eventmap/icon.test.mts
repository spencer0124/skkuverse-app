/**
 * Icon resolution.
 *
 * NOTE: apps/mobile runs `node --test` over `src/**\/*.test.mts`, which is a
 * DIFFERENT runner from packages/shared's vitest. Do not file this under
 * `__tests__/*.test.ts` — it would never run. The SDK imports in icon.ts are
 * type-only, so `--experimental-strip-types` erases them and the module loads
 * under plain Node with no native dependency.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveIcon } from './icon.ts';
import type { IconSpec } from '@skkuverse/shared';

const icons: Record<string, IconSpec> = {
  bar: { kind: 'symbol', symbol: 'red' },
  bar_off: { kind: 'symbol', symbol: 'gray' },
  pin: { kind: 'remote', uri: 'https://skkuverse.com/pin.png', width: 32, height: 40 },
  weird: { kind: 'lottie' } as unknown as IconSpec,
  badSymbol: { kind: 'symbol', symbol: 'chartreuse' },
};

describe('resolveIcon', () => {
  it('resolves a symbol icon, which is all ESKARA ships', () => {
    assert.deepEqual(resolveIcon(icons, 'bar'), { image: { symbol: 'red' } });
    assert.deepEqual(resolveIcon(icons, 'bar_off'), { image: { symbol: 'gray' } });
  });

  it('resolves a remote icon with its dimensions', () => {
    // Without width/height the SDK sizes from the downloaded bitmap, which
    // differs between debug and release builds.
    assert.deepEqual(resolveIcon(icons, 'pin'), {
      image: { httpUri: 'https://skkuverse.com/pin.png' },
      width: 32,
      height: 40,
    });
  });

  it('falls back for an unknown icon id', () => {
    assert.deepEqual(resolveIcon(icons, 'nope'), { image: { symbol: 'green' } });
  });

  it('falls back for a null or missing id', () => {
    assert.deepEqual(resolveIcon(icons, null), { image: { symbol: 'green' } });
    assert.deepEqual(resolveIcon(icons, undefined), { image: { symbol: 'green' } });
  });

  it('falls back for an unknown icon kind', () => {
    assert.deepEqual(resolveIcon(icons, 'weird'), { image: { symbol: 'green' } });
  });

  it('falls back for a symbol outside the SDK union', () => {
    // The wire type is an open string; an unrecognised one renders nothing at
    // all on native, so it must not pass through.
    assert.deepEqual(resolveIcon(icons, 'badSymbol'), { image: { symbol: 'green' } });
  });

  it('falls back when the icons dict is empty', () => {
    assert.deepEqual(resolveIcon({}, 'bar'), { image: { symbol: 'green' } });
  });
});
