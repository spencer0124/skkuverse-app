import { describe, expect, it } from 'vitest';
import { anyOverlap } from './collision';
import { GAP_COEFFICIENT, MAX_OBSTACLE_DUPLICATION, MIN_JUMP_HEIGHT, PLAYER_X, SCORE_COEFFICIENT } from './constants';
import { beginRun, createGame, step, type GameState, type Input } from './engine';
import { BUS_ALTITUDES, OBSTACLE_TYPES, obstacleBoxes, spawnObstacle, type Obstacle } from './obstacles';
import { createPlayer, playerBoxes, pressDuck, startJump, updatePlayer } from './player';
import { formatScore } from './score';
import { BIG_WAVE, BUS, PLAYER_RUN, RIPPLE } from './sprites';

function peakOf(holdTicks: number): number {
  const p = createPlayer();
  startJump(p, 6);
  let peak = 0;
  for (let t = 0; t < 200 && (t === 0 || p.jumping); t++) {
    if (t === holdTicks) {
      p.jumpHeld = false;
      if (p.reachedMinHeight) p.vy = Math.min(p.vy, 5);
      else p.releaseQueued = true;
    }
    updatePlayer(p);
    peak = Math.max(peak, p.y);
  }
  expect(p.y).toBe(0);
  expect(p.jumping).toBe(false);
  return peak;
}

describe('jump', () => {
  it('a one-tick tap still rises past the minimum height and clears a big wave', () => {
    const tap = peakOf(1);
    const bigWaveTop = Math.max(...BIG_WAVE.boxes[0]!.map((b) => BIG_WAVE.sprites[0]![0]!.h - b.y));
    expect(tap).toBeGreaterThan(MIN_JUMP_HEIGHT);
    expect(tap).toBeGreaterThan(bigWaveTop);
  });

  it('holding jumps higher than tapping', () => {
    expect(peakOf(1000)).toBeGreaterThan(peakOf(1) + 10);
  });

  it('ducking in the air drops faster than falling', () => {
    const fall = createPlayer();
    const drop = createPlayer();
    startJump(fall, 6);
    startJump(drop, 6);
    for (let i = 0; i < 8; i++) {
      updatePlayer(fall);
      updatePlayer(drop);
    }
    pressDuck(drop);
    let fallTicks = 0;
    let dropTicks = 0;
    for (; fall.jumping; fallTicks++) updatePlayer(fall);
    for (; drop.jumping; dropTicks++) updatePlayer(drop);
    expect(dropTicks).toBeLessThan(fallTicks / 2);
  });
});

describe('double jump', () => {
  /** Jump, hold to the top, press again at the peak, hold; return the highest point. */
  function doublePeak(): { peak: number; p: ReturnType<typeof createPlayer> } {
    const p = createPlayer();
    startJump(p, 6);
    let peak = 0;
    while (p.vy > 0) {
      updatePlayer(p);
      peak = Math.max(peak, p.y);
    }
    expect(startJump(p, 6)).toBe('double');
    while (p.jumping) {
      updatePlayer(p);
      peak = Math.max(peak, p.y);
    }
    return { peak, p };
  }

  it('a second press in mid-air climbs well above a single held jump', () => {
    expect(doublePeak().peak).toBeGreaterThan(peakOf(1000) + 30);
  });

  it('allows exactly one extra jump, then resets on landing', () => {
    const p = createPlayer();
    expect(startJump(p, 6)).toBe('jump');
    updatePlayer(p);
    expect(startJump(p, 6)).toBe('double');
    updatePlayer(p);
    expect(startJump(p, 6)).toBeNull();
    while (p.jumping) updatePlayer(p);
    expect(startJump(p, 6)).toBe('jump');
  });

  it('cancels a duck-drop', () => {
    const p = createPlayer();
    startJump(p, 6);
    for (let i = 0; i < 6; i++) updatePlayer(p);
    pressDuck(p);
    updatePlayer(p);
    const y = p.y;
    expect(startJump(p, 6)).toBe('double');
    expect(p.speedDrop).toBe(false);
    updatePlayer(p);
    expect(p.y).toBeGreaterThan(y);
  });
});

describe('waves', () => {
  it('stand on the ground, and a group is one wider body, not the same wave repeated', () => {
    for (const art of [RIPPLE, BIG_WAVE]) {
      const [one, two, three] = art.sprites.map((frames) => frames[0]!);
      expect(two!.w).toBeGreaterThan(one!.w);
      expect(three!.w).toBeGreaterThan(two!.w);
      // Boxes reach the ground line and cover the whole group without gaps.
      art.boxes.forEach((boxes, i) => {
        const h = art.sprites[i]![0]!.h;
        expect(boxes.some((b) => b.y + b.h >= h - 2)).toBe(true);
      });
    }
  });

  it('box the water, not the open barrel under the curl', () => {
    for (const art of [RIPPLE, BIG_WAVE]) {
      art.boxes.forEach((boxes, i) => {
        const rows = art.sprites[i]![0]!.rows;
        for (const b of boxes) {
          let empty = 0;
          let total = 0;
          for (let y = Math.floor(b.y / 2); y < Math.ceil((b.y + b.h) / 2); y++) {
            for (let x = Math.floor(b.x / 2); x < Math.ceil((b.x + b.w) / 2); x++) {
              total++;
              if (rows[y]![x] === '.') empty++;
            }
          }
          expect(empty / total).toBeLessThanOrEqual(0.4);
        }
      });
    }
  });
});

describe('the flying shuttle', () => {
  const busAt = (alt: number): Obstacle => ({
    kind: 'bus',
    x: PLAYER_X,
    prevX: PLAYER_X,
    alt,
    size: 1,
    w: BUS[0]!.w,
    h: BUS[0]!.h,
    gap: 0,
    speedOffset: 0,
    born: 0,
  });
  const hits = (alt: number, ducking: boolean) => {
    const p = createPlayer();
    p.ducking = ducking;
    return anyOverlap(playerBoxes(p), obstacleBoxes(busAt(alt)));
  };
  const [low, mid, high] = BUS_ALTITUDES;

  it('is about the size of the gull it replaces', () => {
    expect(BUS[0]!.w).toBeLessThanOrEqual(60);
    expect(BUS[0]!.h).toBeLessThanOrEqual(30);
  });
  it('low must be jumped: it hits a runner standing or ducking', () => {
    expect(hits(low, false)).toBe(true);
    expect(hits(low, true)).toBe(true);
  });
  it('mid must be ducked: it hits a standing runner only', () => {
    expect(hits(mid, false)).toBe(true);
    expect(hits(mid, true)).toBe(false);
  });
  it('high passes over a standing runner', () => {
    expect(hits(high, false)).toBe(false);
  });
});

describe('spawning', () => {
  const spawner = (seed: number) => ({ rng: seed, obstacles: [] as Obstacle[], history: [], tick: 0 });

  it('always leaves at least the minimum gap for the speed', () => {
    const s = spawner(1);
    for (let i = 0; i < 2000; i++) {
      const speed = 6 + (i % 8);
      const o = spawnObstacle(s, speed);
      const type = OBSTACLE_TYPES.find((t) => t.kind === o.kind)!;
      expect(o.gap).toBeGreaterThanOrEqual(Math.round(o.w * speed + type.minGap * GAP_COEFFICIENT));
    }
  });

  it(`never repeats a kind more than ${MAX_OBSTACLE_DUPLICATION} times in a row`, () => {
    const s = spawner(2);
    const kinds = Array.from({ length: 3000 }, () => spawnObstacle(s, 10).kind);
    for (let i = MAX_OBSTACLE_DUPLICATION; i < kinds.length; i++) {
      const run = kinds.slice(i - MAX_OBSTACLE_DUPLICATION, i + 1);
      expect(run.every((k) => k === run[0])).toBe(false);
    }
  });

  it('holds the bus back until the run is fast, and groups waves only at speed', () => {
    const slow = spawner(3);
    const early = Array.from({ length: 500 }, () => spawnObstacle(slow, 8));
    expect(early.some((o) => o.kind === 'bus')).toBe(false);
    expect(Array.from({ length: 200 }, () => spawnObstacle(spawner(6), 4)).every((o) => o.size === 1)).toBe(true);

    const fast = spawner(4);
    const late = Array.from({ length: 1000 }, () => spawnObstacle(fast, 12));
    expect(late.some((o) => o.size === 3)).toBe(true);
    const buses = late.filter((o) => o.kind === 'bus');
    expect(buses.length).toBeGreaterThan(0);
    expect(buses.every((o) => o.size === 1)).toBe(true);
    // Every altitude turns up.
    expect(new Set(buses.map((o) => o.alt)).size).toBe(3);
  });
});

describe('landing and diving', () => {
  /** Step a fresh run (nothing spawns yet) and collect each tick's events. */
  function eventsOf(script: Input[][]): GameState['events'][] {
    const s = createGame(7);
    beginRun(s);
    return script.map((inputs) => {
      step(s, inputs);
      return s.events;
    });
  }

  it('a jump lands once, softly, on the tick it touches down', () => {
    const script: Input[][] = [['jump', 'jumpEnd'], ...Array.from({ length: 80 }, () => [])];
    const events = eventsOf(script);
    const lands = events.flatMap((e, t) => e.filter((x) => x.type === 'land').map((x) => ({ t, x })));
    expect(lands).toHaveLength(1);
    expect(lands[0]!.x).toEqual({ type: 'land', hard: false });
    expect(lands[0]!.t).toBeGreaterThan(10);
  });

  it('ducking in the air dives once, and the landing is hard', () => {
    const script: Input[][] = [['jump'], ...Array.from({ length: 8 }, () => []), ['duck'], ['duckEnd', 'duck'], ...Array.from({ length: 60 }, () => [])];
    const all = eventsOf(script).flat();
    expect(all.filter((e) => e.type === 'dive')).toHaveLength(2);
    expect(all.filter((e) => e.type === 'land')).toEqual([{ type: 'land', hard: true }]);
  });

  it('ducking on the ground is not a dive, and never lands', () => {
    const all = eventsOf([['duck'], [], [], ['duckEnd']]).flat();
    expect(all).toEqual([]);
  });

  it('letting go of a dive before touching down lands softly', () => {
    const script: Input[][] = [['jump'], ...Array.from({ length: 8 }, () => []), ['duck'], ['duckEnd'], ...Array.from({ length: 60 }, () => [])];
    expect(eventsOf(script).flat().filter((e) => e.type === 'land')).toEqual([{ type: 'land', hard: false }]);
  });
});

describe('a run', () => {
  it('does not move before it begins', () => {
    const s = createGame(7);
    for (let i = 0; i < 10; i++) step(s, ['jump']);
    expect(s.tick).toBe(0);
    expect(s.distance).toBe(0);
  });

  it('scores distance and speeds up', () => {
    const s = createGame(7);
    beginRun(s);
    for (let i = 0; i < 60; i++) step(s);
    expect(s.score).toBe(Math.floor(s.distance * SCORE_COEFFICIENT));
    expect(s.speed).toBeGreaterThan(6);
  });

  it('replays exactly from its seed and recorded inputs', () => {
    // Mash the buttons with a pattern of its own until the runner crashes.
    const original = createGame(12345);
    beginRun(original);
    const script: Input[][] = [];
    for (let t = 0; original.status === 'running' && t < 20000; t++) {
      const inputs: Input[] = t % 47 === 0 ? ['jump'] : t % 47 === 9 ? ['jumpEnd'] : t % 131 === 70 ? ['duck'] : t % 131 === 90 ? ['duckEnd'] : [];
      script.push(inputs);
      step(original, inputs);
    }
    expect(original.status).toBe('crashed');

    const replay = createGame(original.seed);
    beginRun(replay);
    const byTick = new Map<number, Input[]>();
    for (const r of original.inputs) {
      if (r.input !== 'revive') byTick.set(r.tick, [...(byTick.get(r.tick) ?? []), r.input]);
    }
    while (replay.status === 'running') step(replay, byTick.get(replay.tick) ?? []);

    expect(replay.tick).toBe(original.tick);
    expect(replay.score).toBe(original.score);
    expect(replay.distance).toBe(original.distance);
  });
});

/**
 * A simple autopilot. If it can survive long runs on several seeds, the spawn
 * rules never deal an impossible pattern — the check that matters most after
 * any tuning of speeds, gaps or hitboxes.
 */
function autopilot(s: GameState): Input[] {
  const p = s.player;
  const front = PLAYER_X + PLAYER_RUN[0]!.w;
  const next = s.obstacles.find((o) => o.x + o.w > PLAYER_X);
  const inputs: Input[] = [];
  if (!next) {
    if (p.duckHeld) inputs.push('duckEnd');
    return inputs;
  }
  const ahead = next.x - front;
  // Rising past a big wave takes about five ticks; leave a little more.
  const lead = (s.speed + next.speedOffset) * 8;
  const mustDuck = next.kind === 'bus' && next.alt === BUS_ALTITUDES[1];
  const ignore = next.kind === 'bus' && next.alt === BUS_ALTITUDES[2];

  if (mustDuck) {
    if (ahead < lead * 2 && !p.duckHeld) inputs.push('duck');
    return inputs;
  }
  if (p.duckHeld) inputs.push('duckEnd');
  if (ignore) return inputs;

  if (!p.jumping && !p.jumpHeld && ahead < lead && ahead > -next.w) inputs.push('jump');
  // Hold for groups, big waves and a low bus; tap for a lone ripple.
  const holdTicks = next.kind === 'ripple' && next.size === 1 ? 1 : 12;
  if (p.jumpHeld && p.jumping && s.inputs.length > 0) {
    const pressedAt = [...s.inputs].reverse().find((r) => r.input === 'jump')!.tick;
    if (s.tick - pressedAt >= holdTicks) inputs.push('jumpEnd');
  }
  return inputs;
}

describe('fairness', () => {
  it.each([1, 2, 3, 4, 5, 6])('an autopilot survives two minutes at full ramp (seed %i)', (seed) => {
    const s = createGame(seed);
    beginRun(s);
    const twoMinutes = 60 * 120;
    while (s.status === 'running' && s.tick < twoMinutes) step(s, autopilot(s));
    expect({ seed, tick: s.tick, score: s.score, status: s.status }).toMatchObject({ status: 'running' });
  });
});

describe('score display', () => {
  it('pads to five digits', () => {
    expect(formatScore(42)).toBe('00042');
    expect(formatScore(123456)).toBe('99999');
  });
});
