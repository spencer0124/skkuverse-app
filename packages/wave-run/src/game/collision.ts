import type { Box } from './sprites';

/** A box in world space: x grows right, y is height above the ground line. */
export interface WorldBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/**
 * Place a sprite-local box (top-down, from the sprite's top-left) in the world,
 * given where the sprite's bottom-left corner sits.
 */
export function toWorld(box: Box, spriteX: number, spriteBottom: number, spriteH: number): WorldBox {
  const bottom = spriteBottom + (spriteH - box.y - box.h);
  return { left: spriteX + box.x, right: spriteX + box.x + box.w, bottom, top: bottom + box.h };
}

/** Touching edges do not count: a pixel-perfect near miss is a miss. */
export function overlaps(a: WorldBox, b: WorldBox): boolean {
  return a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;
}

export function anyOverlap(as: readonly WorldBox[], bs: readonly WorldBox[]): boolean {
  for (const a of as) for (const b of bs) if (overlaps(a, b)) return true;
  return false;
}
