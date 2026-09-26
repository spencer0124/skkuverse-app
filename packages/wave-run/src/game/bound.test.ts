import { describe, expect, it } from 'vitest';
import { ACCELERATION, MAX_SPEED, SCORE_COEFFICIENT, START_SPEED, TICK_HZ } from './constants';
import { BOUND_SLACK_SECONDS, maxScoreAfter, maxScoreAfterTicks } from './bound';
import { beginRun, createGame, step } from './engine';

/** The speed law alone, obstacles aside: the fastest any run can cover ground. */
function fastestScore(ticks: number): number {
  let speed = START_SPEED;
  let distance = 0;
  for (let t = 0; t < ticks; t++) {
    distance += speed;
    speed = Math.min(MAX_SPEED, speed + ACCELERATION);
  }
  return Math.floor(distance * SCORE_COEFFICIENT);
}

describe('the score ceiling', () => {
  it('is never below what the speed law allows, before and after the ramp tops out', () => {
    for (const ticks of [0, 1, 60, 600, 3000, 6999, 7000, 7001, 12000, 60 * 60 * 30]) {
      expect(maxScoreAfterTicks(ticks)).toBeGreaterThanOrEqual(fastestScore(ticks));
    }
  });

  it('is tight: within a point of the speed law', () => {
    for (const ticks of [600, 7000, 20000]) {
      expect(maxScoreAfterTicks(ticks) - fastestScore(ticks)).toBeLessThanOrEqual(1);
    }
  });

  it('holds for real runs at every tick', () => {
    const s = createGame(11);
    beginRun(s);
    while (s.status === 'running') {
      step(s);
      expect(s.score).toBeLessThanOrEqual(maxScoreAfterTicks(s.tick));
    }
  });

  it('adds the network slack to wall-clock seconds', () => {
    expect(maxScoreAfter(0)).toBe(maxScoreAfterTicks(BOUND_SLACK_SECONDS * TICK_HZ));
    expect(maxScoreAfter(-5)).toBe(maxScoreAfter(0));
  });

  // firestore.rules `waveRunMaxScore` computes the same curve; its tests use
  // these two values, so a constant tuned here without the rules fails here.
  it('matches the values the Firestore rules tests pin', () => {
    expect(maxScoreAfter(0)).toBe(94);
    expect(maxScoreAfter(60)).toBe(850);
    expect(maxScoreAfter(300)).toBe(5432);
    expect(maxScoreAfter(600)).toBe(11282);
  });
});
