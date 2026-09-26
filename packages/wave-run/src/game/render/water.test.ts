import { describe, expect, it } from 'vitest';
import { PLAYER_X } from '../constants';
import { beginRun, createGame, type GameState } from '../engine';
import { spriteOf, type Obstacle } from '../obstacles';
import { WaterFx } from './water';

function waveAt(x: number): Obstacle {
  const sp = spriteOf('wave', 1);
  return { kind: 'wave', x, prevX: x, alt: 0, size: 1, w: sp.w, h: sp.h, gap: 0, speedOffset: 0, born: 0 };
}

function running(obstacles: Obstacle[], playerY = 0): GameState {
  const s = createGame(1);
  beginRun(s);
  s.obstacles = obstacles;
  s.player.y = playerY;
  return s;
}

describe('water effects', () => {
  it('throws spray off a wave as it comes', () => {
    const fx = new WaterFx();
    const s = running([waveAt(300)]);
    for (let t = 0; t <= 500; t += 16) fx.update(s, t);
    expect(fx.count).toBeGreaterThan(5);
  });

  it('splashes once — 첨벙 — when a wave passes under a jumping runner', () => {
    const fx = new WaterFx();
    const wave = waveAt(PLAYER_X);
    const s = running([wave], 30);
    fx.update(s, 0);
    fx.update(s, 16);
    const afterOne = fx.count;
    expect(afterOne).toBeGreaterThanOrEqual(22);
    fx.update(s, 32);
    expect(fx.count - afterOne).toBeLessThan(10); // no second burst for the same wave
  });

  it('does not splash a runner the wave simply hits', () => {
    const fx = new WaterFx();
    const s = running([waveAt(PLAYER_X)], 0);
    fx.update(s, 0);
    fx.update(s, 16);
    expect(fx.count).toBeLessThan(10);
  });

  it('breaks over the runner on a crash into a wave, not into the bus', () => {
    const wave = new WaterFx();
    const hit = running([]);
    hit.status = 'crashed';
    hit.hit = 'wave';
    wave.update(hit, 0);
    wave.update(hit, 16);
    expect(wave.count).toBeGreaterThanOrEqual(30);

    const bus = new WaterFx();
    const hitBus = running([]);
    hitBus.status = 'crashed';
    hitBus.hit = 'bus';
    bus.update(hitBus, 0);
    bus.update(hitBus, 16);
    expect(bus.count).toBe(0);
  });
});
