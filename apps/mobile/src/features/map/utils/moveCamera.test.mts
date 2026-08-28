/**
 * Camera mechanism choice.
 *
 * The Naver SDK splits a camera across two mechanisms and neither carries all
 * of it: `animateCameraTo` takes a coordinate, a zoom and a duration but can
 * NOT set tilt or bearing, while the declarative `camera` prop carries tilt and
 * bearing and has no duration.
 *
 * So the rule is not "is the target flat" — it is **does the attitude have to
 * change**. A flat target sent imperatively at a rotated map arrives still
 * rotated, silently, because the mechanism has no way to say "bearing 0". That
 * was the first version of this file and is what these tests exist to keep
 * fixed.
 *
 * NOTE: apps/mobile runs `node --test`, a different runner from packages/shared's
 * vitest. `moveCamera.ts` imports only types, so the module loads under plain
 * Node with no SDK dependency.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moveCamera } from './moveCamera.ts';
import type { MapChipCamera } from '@skkuverse/shared';

const FLAT: MapChipCamera = {
  lat: 37.295129,
  lng: 126.971234,
  zoom: 17.5,
  tilt: 0,
  bearing: 0,
  durationMs: 500,
};

const spy = () => {
  const calls: unknown[] = [];
  return { calls, fn: (arg: unknown) => calls.push(arg) };
};

/** Runs a move and reports which mechanism took it. */
const run = (target: MapChipCamera, current: { tilt?: number; bearing?: number } | null) => {
  const animate = spy();
  const command = spy();
  moveCamera(target, { current, animate: animate.fn, command: command.fn });
  return { animate, command };
};

describe('moveCamera — the imperative path, when no attitude has to change', () => {
  it('animates a flat target at an already flat map, so it keeps its duration', () => {
    const { animate, command } = run(FLAT, { tilt: 0, bearing: 0 });
    assert.equal(command.calls.length, 0);
    assert.deepEqual(animate.calls[0], {
      latitude: 37.295129,
      longitude: 126.971234,
      zoom: 17.5,
      duration: 500,
    });
  });

  it('animates a TILTED target at a map already at that tilt', () => {
    // `animateCameraTo` cannot set tilt, but it does not clear it either — so
    // when the attitude is already right, the imperative path is both correct
    // and the one that honours durationMs.
    const { animate, command } = run({ ...FLAT, tilt: 45 }, { tilt: 45, bearing: 0 });
    assert.equal(command.calls.length, 0);
    assert.equal(animate.calls.length, 1);
  });

  it('treats a map that has not reported a camera as flat', () => {
    // Nothing has settled yet, so the map is at its initial camera — built from
    // a campus definition, and every campus ships tilt and bearing 0.
    const { animate, command } = run(FLAT, null);
    assert.equal(command.calls.length, 0);
    assert.equal(animate.calls.length, 1);
  });

  it('reads a missing attitude member as 0 rather than as unknown', () => {
    const { animate } = run(FLAT, {});
    assert.equal(animate.calls.length, 1);
  });
});

describe('moveCamera — the prop path, when the attitude has to change', () => {
  it('un-rotates a rotated map for a bearing-0 target', () => {
    // THE BUG THIS FILE EXISTS FOR. The target is flat, so a "is the target
    // flat" test would send it imperatively and the map would stay rotated,
    // with no error on either side.
    const { animate, command } = run(FLAT, { tilt: 0, bearing: 45 });
    assert.equal(animate.calls.length, 0);
    assert.deepEqual(command.calls[0], {
      latitude: 37.295129,
      longitude: 126.971234,
      zoom: 17.5,
      tilt: 0,
      bearing: 0,
    });
  });

  it('un-tilts a tilted map for a tilt-0 target', () => {
    const { animate, command } = run(FLAT, { tilt: 40, bearing: 0 });
    assert.equal(animate.calls.length, 0);
    assert.equal((command.calls[0] as { tilt: number }).tilt, 0);
  });

  it('applies a tilt the map does not have', () => {
    const { animate, command } = run({ ...FLAT, tilt: 45 }, { tilt: 0, bearing: 0 });
    assert.equal(animate.calls.length, 0);
    assert.equal((command.calls[0] as { tilt: number }).tilt, 45);
  });

  it('applies a bearing the map does not have', () => {
    const { animate, command } = run({ ...FLAT, bearing: 90 }, { tilt: 0, bearing: 0 });
    assert.equal(animate.calls.length, 0);
    assert.equal((command.calls[0] as { bearing: number }).bearing, 90);
  });
});
