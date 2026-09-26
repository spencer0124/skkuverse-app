/**
 * mulberry32. The state is a plain number held on the game state, not hidden in
 * a closure, so a run is fully described by its seed and its inputs — the
 * property a server-side score check will replay against later.
 */
export function nextRandom(holder: { rng: number }): number {
  let t = (holder.rng = (holder.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inclusive on both ends. */
export function randomInt(holder: { rng: number }, min: number, max: number): number {
  return Math.floor(nextRandom(holder) * (max - min + 1)) + min;
}

export function newSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}
