import {
  DOUBLE_JUMP_VELOCITY,
  DROP_VELOCITY,
  GRAVITY,
  JUMP_VELOCITY,
  MAX_JUMP_HEIGHT,
  MIN_JUMP_HEIGHT,
  PLAYER_X,
  SPEED_DROP_COEFFICIENT,
} from './constants';
import { toWorld, type WorldBox } from './collision';
import { PLAYER_DUCK, PLAYER_DUCK_BOXES, PLAYER_RUN, PLAYER_RUN_BOXES } from './sprites';

export interface Player {
  /** Height of the feet above the ground line. */
  y: number;
  prevY: number;
  /** Upward speed in px per tick; negative while falling. */
  vy: number;
  jumping: boolean;
  /** Jumps since leaving the ground: 1, or 2 after the mid-air one. */
  jumps: number;
  /** Height the current jump started from; the min/max heights count from here. */
  jumpBase: number;
  ducking: boolean;
  /** Ducking in mid-air: fall fast. */
  speedDrop: boolean;
  reachedMinHeight: boolean;
  /** The jump was released before it reached the minimum height; cut it there. */
  releaseQueued: boolean;
  jumpHeld: boolean;
  duckHeld: boolean;
}

export function createPlayer(): Player {
  return {
    y: 0,
    prevY: 0,
    vy: 0,
    jumping: false,
    jumps: 0,
    jumpBase: 0,
    ducking: false,
    speedDrop: false,
    reachedMinHeight: false,
    releaseQueued: false,
    jumpHeld: false,
    duckHeld: false,
  };
}

export type JumpKind = 'jump' | 'double';

/**
 * A faster run jumps a little harder, as in the original, so gaps stay
 * clearable. Once airborne, one more press gives a second jump from wherever
 * the runner is — rising or falling, and it cancels a duck-drop.
 */
export function startJump(p: Player, speed: number): JumpKind | null {
  if (p.ducking) return null;
  if (!p.jumping) {
    p.jumping = true;
    p.jumps = 1;
    p.vy = JUMP_VELOCITY + speed / 10;
  } else if (p.jumps < 2) {
    p.jumps = 2;
    p.vy = DOUBLE_JUMP_VELOCITY + speed / 10;
    p.speedDrop = false;
  } else {
    return null;
  }
  p.jumpBase = p.y;
  p.reachedMinHeight = false;
  p.releaseQueued = false;
  return p.jumps === 1 ? 'jump' : 'double';
}

/** Releasing the jump cuts the rise short, but never below the minimum height:
 *  a phone tap can be a single frame long and must still clear a ripple. */
export function releaseJump(p: Player): void {
  if (!p.jumping) return;
  if (p.reachedMinHeight) endJump(p);
  else p.releaseQueued = true;
}

function endJump(p: Player): void {
  if (p.vy > DROP_VELOCITY) p.vy = DROP_VELOCITY;
}

export function pressDuck(p: Player): void {
  if (p.jumping) {
    if (!p.speedDrop) {
      p.speedDrop = true;
      p.vy = -1;
    }
  } else {
    p.ducking = true;
  }
}

export function releaseDuck(p: Player): void {
  p.ducking = false;
  p.speedDrop = false;
}

export function updatePlayer(p: Player): void {
  p.prevY = p.y;
  if (!p.jumping) return;

  p.y += p.speedDrop ? p.vy * SPEED_DROP_COEFFICIENT : p.vy;
  p.vy -= GRAVITY;

  const rise = p.y - p.jumpBase;
  if (rise > MIN_JUMP_HEIGHT || p.speedDrop) {
    p.reachedMinHeight = true;
    if (p.releaseQueued) endJump(p);
  }
  if (rise > MAX_JUMP_HEIGHT || p.speedDrop) endJump(p);

  if (p.y <= 0) {
    p.y = 0;
    p.vy = 0;
    p.jumping = false;
    p.jumps = 0;
    p.jumpBase = 0;
    p.speedDrop = false;
    p.reachedMinHeight = false;
    p.releaseQueued = false;
    // Holding duck through the landing keeps you down.
    p.ducking = p.duckHeld;
  }
}

export function playerBoxes(p: Player): WorldBox[] {
  const ducking = p.ducking && !p.jumping;
  const sprite = ducking ? PLAYER_DUCK[0]! : PLAYER_RUN[0]!;
  const boxes = ducking ? PLAYER_DUCK_BOXES : PLAYER_RUN_BOXES;
  return boxes.map((b) => toWorld(b, PLAYER_X, p.y, sprite.h));
}
