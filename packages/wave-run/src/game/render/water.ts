import { PLAYER_X, TICK_HZ } from '../constants';
import type { GameState } from '../engine';
import { crestsOf, type Obstacle } from '../obstacles';
import type { Layout } from './layout';
import { BRAND } from './palette';

/**
 * Spray, splashes and wakes: the water's life around the waves.
 *
 * Purely cosmetic, and deliberately outside the simulation — it runs on the
 * display clock with Math.random, never touches a hitbox, and a replay of a run
 * does not need it. Positions are in world units (x from the world's left edge,
 * y as height above the ground) so drops travel with the track.
 */

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** In art pixels. */
  size: 1 | 2 | 3;
  /** Index into the day or night colors, picked at draw time. */
  tone: number;
}

/** World px/s². */
const GRAVITY = 520;
const MAX_DROPS = 260;
/** Drops a second from each crest. */
const CREST_RATE = 14;
/** Drops a second from the whitewater at a wave's foot. */
const FOOT_RATE = 10;
/** How far a wake of foam trails behind a wave, in world px. */
const WAKE = 70;

/** Against a pale noon sky the water needs body; against the night it should glow. */
const DAY_COLORS = ['#FFFFFF', '#3FC48A', BRAND.green, '#7FE3AA'];
const NIGHT_COLORS = [BRAND.mint, '#7FE3AA', BRAND.lime, BRAND.lime2];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;

export class WaterFx {
  private drops: Drop[] = [];
  private readonly budget = new WeakMap<Obstacle, number>();
  /** Waves that have already splashed the runner on the way past. */
  private readonly splashed = new WeakSet<Obstacle>();
  private last: number | null = null;
  /** Runs whose crash has already thrown its splash. */
  private readonly crashed = new WeakSet<GameState>();

  reset(): void {
    this.drops = [];
  }

  /** How many drops are in the air. */
  get count(): number {
    return this.drops.length;
  }

  update(s: GameState, now: number): void {
    const dt = this.last === null ? 0 : Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (dt === 0) return;
    const running = s.status === 'running';
    const track = running ? s.speed * TICK_HZ : 0;

    for (const d of this.drops) {
      d.age += dt;
      d.x += (d.vx - track) * dt;
      d.vy -= GRAVITY * dt;
      d.y += d.vy * dt;
    }
    this.drops = this.drops.filter((d) => d.age < d.life && d.y > -2);
    // Swept by a wave: it breaks right over the runner.
    if (s.status === 'crashed' && s.hit !== 'bus' && !this.crashed.has(s)) {
      this.crashed.add(s);
      this.burst(PLAYER_X + 20, s.player.y + 10, 40);
    }
    if (!running) return;

    for (const o of s.obstacles) {
      if (o.kind === 'bus') continue;
      const crests = crestsOf(o);
      let budget = (this.budget.get(o) ?? 0) + dt * (CREST_RATE * crests.length + FOOT_RATE);
      while (budget >= 1) {
        budget -= 1;
        if (Math.random() < FOOT_RATE / (CREST_RATE * crests.length + FOOT_RATE)) {
          // Whitewater kicked up at the foot of the face.
          this.push({ x: o.x + rand(0, 10), y: 1, vx: rand(-70, -20), vy: rand(30, 90), life: rand(0.25, 0.45), size: 1 });
        } else {
          // Spray thrown forward off a crest.
          const c = pick(crests);
          this.push({ x: o.x + c.x + rand(-4, 4), y: c.y + rand(-2, 2), vx: rand(-150, -40), vy: rand(40, 150), life: rand(0.45, 0.8), size: Math.random() < 0.35 ? 2 : 1 });
        }
      }
      this.budget.set(o, budget);

      // 첨벙: the wave slaps up under a runner who is clearing it.
      const under = o.x < PLAYER_X + 24 && o.x + o.w > PLAYER_X + 8;
      if (under && s.player.y > 6 && !this.splashed.has(o)) {
        this.splashed.add(o);
        this.burst(PLAYER_X + 16, 2, 22);
      }
    }
  }

  /** A fan of drops thrown up from one spot. */
  burst(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      this.push({ x: x + rand(-6, 6), y, vx: rand(-160, 80), vy: rand(110, 260), life: rand(0.55, 0.9), size: r < 0.2 ? 3 : r < 0.6 ? 2 : 1 });
    }
  }

  private push(d: Omit<Drop, 'age' | 'tone'>): void {
    if (this.drops.length >= MAX_DROPS) this.drops.shift();
    this.drops.push({ ...d, age: 0, tone: Math.floor(Math.random() * DAY_COLORS.length) });
  }

  /** Foam sheeting back over the ground behind each wave. */
  drawWakes(ctx: CanvasRenderingContext2D, L: Layout, s: GameState, alpha: number, t: number): void {
    const p = L.pixel;
    for (const o of s.obstacles) {
      if (o.kind === 'bus') continue;
      const x0 = o.prevX + (o.x - o.prevX) * alpha + o.w - 6;
      for (let i = 0; i < WAKE; i += 3) {
        const fade = 1 - i / WAKE;
        // The sheet thins out and shimmers as it drains away.
        if (Math.sin(i * 0.9 - t * 9) < -0.2 + i / WAKE) continue;
        ctx.globalAlpha = 0.75 * fade;
        ctx.fillStyle = i % 2 ? (s.night > 0.5 ? BRAND.mint : '#FFFFFF') : '#7FE3AA';
        const sx = Math.round(L.worldLeft + (x0 + i) * L.scale);
        ctx.fillRect(sx, L.groundY - p, p * 2, p);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawDrops(ctx: CanvasRenderingContext2D, L: Layout, night: number): void {
    const p = L.pixel;
    const colors = night > 0.5 ? NIGHT_COLORS : DAY_COLORS;
    for (const d of this.drops) {
      const left = d.life - d.age;
      ctx.globalAlpha = Math.min(1, left / (d.life * 0.4));
      ctx.fillStyle = colors[d.tone]!;
      const s = p * d.size;
      ctx.fillRect(Math.round(L.worldLeft + d.x * L.scale - s / 2), Math.round(L.groundY - d.y * L.scale - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }
}
