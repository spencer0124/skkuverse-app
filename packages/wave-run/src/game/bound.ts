import { ACCELERATION, MAX_SPEED, SCORE_COEFFICIENT, START_SPEED, TICK_HZ } from './constants';

/**
 * The highest score a run can have after a given time — the ceiling the
 * leaderboard's Firestore rules hold a submission to (`waveRunMaxScore` in
 * `apps/mobile/firestore.rules`, which computes this same curve).
 *
 * Distance per tick is the speed, and the speed climbs by ACCELERATION a tick
 * from START_SPEED until MAX_SPEED, so the distance is a parabola that turns
 * into a line once the ramp tops out. Obstacles only ever cost a run time, so
 * no real run can beat this; a revive or a pause stops the ticks while the wall
 * clock keeps going, which only loosens it.
 */
export function maxScoreAfterTicks(ticks: number): number {
  const t = Math.max(0, ticks);
  const ramp = Math.round((MAX_SPEED - START_SPEED) / ACCELERATION);
  const distance =
    t <= ramp
      ? START_SPEED * t + (ACCELERATION / 2) * t * t
      : START_SPEED * ramp + (ACCELERATION / 2) * ramp * ramp + MAX_SPEED * (t - ramp);
  return Math.floor(distance * SCORE_COEFFICIENT);
}

/**
 * The host stamps the run before the first tap, so the stamp can only be
 * early; this much extra time covers a re-stamp at the tap (a sign-in in
 * between, or a stamp gone stale) that lands a round trip late.
 */
export const BOUND_SLACK_SECONDS = 10;

/** The ceiling after `seconds` of wall-clock time since the run was stamped. */
export function maxScoreAfter(seconds: number): number {
  return maxScoreAfterTicks((Math.max(0, seconds) + BOUND_SLACK_SECONDS) * TICK_HZ);
}
