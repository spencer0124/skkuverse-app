import { describe, expect, it } from 'vitest';
import { CLEAR_TICKS, MAX_REVIVES, REVIVE_CLEAR_TICKS } from './constants';
import { beginRun, createGame, revive, step, type GameState, type Input } from './engine';

/** Run with no input until the runner hits something. */
function crash(s: GameState, limit = 20000): void {
  for (let t = 0; s.status === 'running' && t < limit; t++) step(s);
  expect(s.status).toBe('crashed');
}

describe('revive', () => {
  it('only a crashed run can be revived', () => {
    const s = createGame(3);
    expect(revive(s)).toBe(false);
    beginRun(s);
    step(s);
    expect(revive(s)).toBe(false);
    expect(s.revives).toBe(0);
  });

  it('puts the runner back on its feet with the track cleared, keeping score and speed', () => {
    const s = createGame(3);
    beginRun(s);
    crash(s);
    const { score, speed, tick, distance } = s;

    expect(revive(s)).toBe(true);
    expect(s.status).toBe('running');
    expect(s.hit).toBeNull();
    expect(s.obstacles).toEqual([]);
    expect(s.player.y).toBe(0);
    expect(s.player.jumping).toBe(false);
    expect(s.revives).toBe(1);
    expect([s.score, s.speed, s.tick, s.distance]).toEqual([score, speed, tick, distance]);
    expect(s.inputs.at(-1)).toEqual({ tick, input: 'revive' });
  });

  it('holds spawning back for a grace period, then the run goes on', () => {
    const s = createGame(3);
    beginRun(s);
    crash(s);
    revive(s);
    const revivedAt = s.tick;
    for (let i = 0; i < REVIVE_CLEAR_TICKS; i++) {
      step(s);
      expect(s.obstacles).toEqual([]);
    }
    expect(s.tick).toBe(revivedAt + REVIVE_CLEAR_TICKS);
    crash(s);
    expect(s.tick).toBeGreaterThan(revivedAt + REVIVE_CLEAR_TICKS);
  });

  it(`allows at most ${MAX_REVIVES} per run`, () => {
    const s = createGame(3);
    beginRun(s);
    for (let i = 0; i < MAX_REVIVES; i++) {
      crash(s);
      expect(revive(s)).toBe(true);
    }
    crash(s);
    expect(revive(s)).toBe(false);
    expect(s.status).toBe('crashed');
    expect(s.revives).toBe(MAX_REVIVES);
  });

  it('a revived run still replays exactly from its seed and recorded inputs', () => {
    const original = createGame(777);
    beginRun(original);
    for (let t = 0; t < 40000; t++) {
      if (original.status === 'crashed') {
        if (!revive(original)) break;
        continue;
      }
      const inputs: Input[] = t % 53 === 0 ? ['jump'] : t % 53 === 11 ? ['jumpEnd'] : [];
      step(original, inputs);
    }
    expect(original.revives).toBe(MAX_REVIVES);

    const replay = createGame(original.seed);
    beginRun(replay);
    const byTick = new Map<number, Input[]>();
    const revivesAt = new Set<number>();
    for (const r of original.inputs) {
      if (r.input === 'revive') revivesAt.add(r.tick);
      else byTick.set(r.tick, [...(byTick.get(r.tick) ?? []), r.input]);
    }
    for (;;) {
      if (replay.status === 'crashed') {
        if (!revivesAt.has(replay.tick) || !revive(replay)) break;
        continue;
      }
      step(replay, byTick.get(replay.tick) ?? []);
    }
    expect([replay.tick, replay.score, replay.revives]).toEqual([original.tick, original.score, original.revives]);
  });

  it('keeps the opening grace separate from the revive grace', () => {
    expect(REVIVE_CLEAR_TICKS).toBeLessThan(CLEAR_TICKS);
  });
});
