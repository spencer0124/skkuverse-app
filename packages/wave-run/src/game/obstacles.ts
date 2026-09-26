import {
  GAP_COEFFICIENT,
  MAX_GAP_COEFFICIENT,
  MAX_OBSTACLE_DUPLICATION,
  MAX_OBSTACLE_LENGTH,
  VIEW_WIDTH,
} from './constants';
import { toWorld, type WorldBox } from './collision';
import { nextRandom, randomInt } from './rng';
import {
  BIG_WAVE,
  BUS,
  BUS_BOXES,
  PLAYER_DUCK,
  PLAYER_DUCK_BOXES,
  PLAYER_RUN,
  PLAYER_RUN_BOXES,
  RIPPLE,
  WAVE_FRAMES,
  type Box,
  type Sprite,
  type WaveArt,
} from './sprites';

export type ObstacleKind = 'ripple' | 'wave' | 'bus';

interface ObstacleType {
  kind: ObstacleKind;
  /** Groups of more than one only appear above this speed. */
  multipleSpeed: number;
  /** Never spawned below this speed. */
  minSpeed: number;
  minGap: number;
}

const topOf = (boxes: readonly Box[], h: number) => Math.max(...boxes.map((b) => h - b.y));

/** How tall the runner stands and ducks, by hitbox. */
const STAND_TOP = topOf(PLAYER_RUN_BOXES, PLAYER_RUN[0]!.h);
const DUCK_TOP = topOf(PLAYER_DUCK_BOXES, PLAYER_DUCK[0]!.h);
/** Gap between the bus sprite's bottom edge and its lowest hitbox. */
const BUS_UNDER = Math.min(...BUS_BOXES.map((b) => BUS[0]!.h - b.y - b.h));

/**
 * The bus flies at one of three heights, as the original's pterodactyl does,
 * derived from the hitboxes so they keep their meaning when the art changes:
 * low must be jumped; mid clears a duck but hits a standing runner; high passes
 * over a standing runner and punishes a jump into it.
 */
export const BUS_ALTITUDES = [0, DUCK_TOP - BUS_UNDER + 2, STAND_TOP - BUS_UNDER + 2] as const;
/** The bus drifts a little faster or slower than the ground, like the pterodactyl. */
const BUS_DRIFT = 0.8;

export const OBSTACLE_TYPES: readonly ObstacleType[] = [
  { kind: 'ripple', multipleSpeed: 4, minSpeed: 0, minGap: 120 },
  { kind: 'wave', multipleSpeed: 7, minSpeed: 0, minGap: 120 },
  // In the pterodactyl's slot, from the same speed.
  { kind: 'bus', multipleSpeed: 999, minSpeed: 8.5, minGap: 150 },
];

const WAVES: Record<'ripple' | 'wave', WaveArt> = { ripple: RIPPLE, wave: BIG_WAVE };

/** The sprite for an obstacle of this kind and group size, in a given frame. */
export function spriteOf(kind: ObstacleKind, size: number, frame = 0): Sprite {
  return kind === 'bus' ? BUS[frame % 2]! : WAVES[kind].sprites[size - 1]![frame]!;
}

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  prevX: number;
  /** Height of the sprite's bottom edge above the ground. */
  alt: number;
  size: number;
  /** Logical size of the whole group. */
  w: number;
  h: number;
  /** Clear track to leave after this obstacle before the next one. */
  gap: number;
  /** Speed against the ground; only the bus drifts.  */
  speedOffset: number;
  /** Tick it spawned on, so its animation is deterministic. */
  born: number;
}

interface Spawner {
  rng: number;
  /** Debug: spawn nothing but this kind. */
  only?: ObstacleKind | null;
  obstacles: Obstacle[];
  /** Kinds spawned so far, newest last, for the no-long-repeats rule. */
  history: ObstacleKind[];
  tick: number;
}

function repeatsTooOften(history: readonly ObstacleKind[], kind: ObstacleKind): boolean {
  const recent = history.slice(-MAX_OBSTACLE_DUPLICATION);
  return recent.length === MAX_OBSTACLE_DUPLICATION && recent.every((k) => k === kind);
}

/**
 * The gap scales with the group's width times the current speed, so the clear
 * track after an obstacle always takes roughly as long to cross whatever the
 * pace; a random stretch on top keeps the rhythm from being learnable.
 */
export function gapFor(type: ObstacleType, width: number, speed: number, rng: { rng: number }): number {
  const minGap = Math.round(width * speed + type.minGap * GAP_COEFFICIENT);
  const maxGap = Math.round(minGap * MAX_GAP_COEFFICIENT);
  return randomInt(rng, minGap, maxGap);
}

export function spawnObstacle(s: Spawner, speed: number): Obstacle {
  // Never empty: the repeat rule excludes at most one kind, and two kinds
  // spawn at any speed.
  const pool = s.only
    ? OBSTACLE_TYPES.filter((t) => t.kind === s.only)
    : OBSTACLE_TYPES.filter((t) => t.minSpeed <= speed && !repeatsTooOften(s.history, t.kind));
  const type = pool[Math.floor(nextRandom(s) * pool.length)]!;

  const size = speed > type.multipleSpeed ? randomInt(s, 1, MAX_OBSTACLE_LENGTH) : 1;
  const { w, h } = spriteOf(type.kind, size);
  const bus = type.kind === 'bus';
  const alt = bus ? BUS_ALTITUDES[Math.floor(nextRandom(s) * BUS_ALTITUDES.length)]! : 0;
  const speedOffset = bus ? (nextRandom(s) > 0.5 ? BUS_DRIFT : -BUS_DRIFT) : 0;

  const obstacle: Obstacle = {
    kind: type.kind,
    x: VIEW_WIDTH,
    prevX: VIEW_WIDTH,
    alt,
    size,
    w,
    h,
    gap: gapFor(type, w, speed, s),
    speedOffset,
    born: s.tick,
  };
  s.obstacles.push(obstacle);
  s.history.push(type.kind);
  if (s.history.length > MAX_OBSTACLE_DUPLICATION) s.history.shift();
  return obstacle;
}

export function updateObstacles(s: Spawner, speed: number, spawning: boolean): void {
  for (const o of s.obstacles) {
    o.prevX = o.x;
    o.x -= speed + o.speedOffset;
  }
  while (s.obstacles.length > 0 && s.obstacles[0]!.x + s.obstacles[0]!.w < 0) s.obstacles.shift();

  if (!spawning) return;
  const last = s.obstacles[s.obstacles.length - 1];
  if (!last || last.x + last.w + last.gap < VIEW_WIDTH) spawnObstacle(s, speed);
}

/** A wave steps through its motion loop every 6 ticks; the bus flaps every 10, the original's rate. */
export function animFrame(o: Obstacle, tick: number): number {
  return o.kind === 'bus' ? Math.floor((tick - o.born) / 10) % 2 : Math.floor((tick - o.born) / 6) % WAVE_FRAMES;
}

/** Where spray leaves each crest of a wave, in logical px from the sprite's bottom-left. */
export function crestsOf(o: Obstacle): readonly { x: number; y: number }[] {
  return o.kind === 'bus' ? [] : WAVES[o.kind].crests[o.size - 1]!;
}

export function obstacleBoxes(o: Obstacle): WorldBox[] {
  const boxes: readonly Box[] = o.kind === 'bus' ? BUS_BOXES : WAVES[o.kind].boxes[o.size - 1]!;
  return boxes.map((b) => toWorld(b, o.x, o.alt, o.h));
}
