/**
 * Every tunable number in one place. The values start from Chromium's offline
 * T-Rex runner (`offline.js`) so the feel is familiar, then diverge where a
 * portrait phone needs it. Units are logical pixels and simulation ticks; one
 * tick is one 60 Hz frame, which is the unit the original's constants assume.
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** World width visible on screen. The original shows 600; a portrait phone
 *  would shrink everything to a sliver at that, so less of the track is shown
 *  and the sprites draw larger. Lower it and reaction time drops with it: at top
 *  speed an obstacle takes about half a second to cross 460. */
export const VIEW_WIDTH = 460;
/** Logical height of the playfield strip above the ground line. */
export const VIEW_HEIGHT = 150;
export const PLAYER_X = 24;

// Speed, in logical px per tick.
export const START_SPEED = 6;
export const MAX_SPEED = 13;
export const ACCELERATION = 0.001;

// Player physics. Height is measured up from the ground line.
export const GRAVITY = 0.6;
export const JUMP_VELOCITY = 10;
/** Past this height a released jump starts to fall. Below it, a jump always
 *  rises at least this far, so a quick tap still clears a small wave. */
export const MIN_JUMP_HEIGHT = 30;
/** Holding the jump stops adding height past this. */
export const MAX_JUMP_HEIGHT = 63;
/** Upward speed a jump is cut to when released or capped. */
export const DROP_VELOCITY = 5;
/** The second, mid-air jump: a little weaker than the first. */
export const DOUBLE_JUMP_VELOCITY = 8.5;
/** Ducking in the air plunges at this multiple of the fall speed. */
export const SPEED_DROP_COEFFICIENT = 3;

// Obstacles.
/** Nothing spawns for this long after the start, so the first tap is free. */
export const CLEAR_TICKS = Math.round(3000 / TICK_MS);
export const GAP_COEFFICIENT = 0.6;
export const MAX_GAP_COEFFICIENT = 1.5;
/** The same obstacle type never appears more than this many times in a row. */
export const MAX_OBSTACLE_DUPLICATION = 2;
export const MAX_OBSTACLE_LENGTH = 3;

// Score.
export const SCORE_COEFFICIENT = 0.025;
export const MILESTONE = 100;
/** Every this many points the milestone chirp becomes a longer run of notes. */
export const BIG_MILESTONE = 1000;
/** Day and night swap every this many points (the original inverts at 700). */
export const NIGHT_EVERY = 700;
/** Ticks the day/night crossfade takes. */
export const NIGHT_FADE_TICKS = 90;

// Revives, bought with a rewarded ad on the host.
/** A run can come back this many times; each one clears the track. */
export const MAX_REVIVES = 2;
/** Nothing spawns for this long after a revive, so the runner gets its footing. */
export const REVIVE_CLEAR_TICKS = Math.round(2000 / TICK_MS);
