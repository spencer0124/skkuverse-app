import { describe, expect, test } from 'vitest';
import { SOUND_BANK } from './sfx';
import { renderTone } from './zzfx';

const RATE = 44100;

describe('renderTone', () => {
  test('lasts attack + sustain + release, plus ZzFX’s 9-sample ramp', () => {
    expect(renderTone([1, 0, 440, 0.01, 0.05, 0.1], RATE).length).toBe(Math.floor((0.01 + 0.05 + 0.1) * RATE + 9));
  });

  test('renders the same samples every time', () => {
    const tone = [0.5, 0, 300, 0, 0.05, 0.1, 4, 1, -2, 0, 0, 0, 0, 1, 0, 0.1];
    expect(renderTone(tone, RATE)).toEqual(renderTone(tone, RATE));
  });

  test('a shape curve of 0 is a square at ± the volume once the attack is done', () => {
    for (const s of renderTone([1, 0, 220, 0, 0.05, 0.05, 0, 0], RATE).slice(20, 1000)) {
      expect(Math.abs(s)).toBeCloseTo(0.3, 6);
    }
  });
});

describe('the sound bank', () => {
  test.each(Object.entries(SOUND_BANK.TONES))('%s is short, finite and never clips', (_, tone) => {
    const samples = renderTone(tone, RATE);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.length / RATE).toBeLessThan(0.5);
    for (const s of samples) {
      expect(Number.isFinite(s)).toBe(true);
      expect(Math.abs(s)).toBeLessThanOrEqual(1);
    }
  });

  test('every cue is over within half a second of its last note', () => {
    for (const cue of Object.values(SOUND_BANK.CUES)) {
      const last = Math.max(...cue.notes.map((n: { at?: number }) => n.at ?? 0));
      expect(last).toBeLessThan(0.5);
    }
  });
});
