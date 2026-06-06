import { describe, it, expect } from 'vitest';
import {
  buildGenerateResult,
  resolveGenerateOptions,
} from '../generateResult';

describe('buildGenerateResult', () => {
  it('computes tokPerSec from outputTokens / elapsedSec', () => {
    const r = buildGenerateResult({
      text: 'hi',
      inputTokens: 10,
      outputTokens: 40,
      firstTokenMs: 1684,
      elapsedSec: 4,
    });
    expect(r.tokPerSec).toBeCloseTo(10, 5);
    expect(r.text).toBe('hi');
    expect(r.inputTokens).toBe(10);
    expect(r.outputTokens).toBe(40);
    expect(r.firstTokenMs).toBe(1684);
  });

  it('guards divide-by-zero (elapsedSec = 0 -> tokPerSec 0)', () => {
    const r = buildGenerateResult({
      text: '',
      inputTokens: 5,
      outputTokens: 0,
      firstTokenMs: 0,
      elapsedSec: 0,
    });
    expect(r.tokPerSec).toBe(0);
  });

  it('guards negative elapsed (clock skew) -> tokPerSec 0', () => {
    const r = buildGenerateResult({
      text: 'x',
      inputTokens: 1,
      outputTokens: 3,
      firstTokenMs: 1,
      elapsedSec: -2,
    });
    expect(r.tokPerSec).toBe(0);
  });
});

describe('resolveGenerateOptions', () => {
  const defaults = {
    nPredict: 512,
    temperature: 0.7,
    topP: 0.95,
    stop: ['<|eot_id|>'],
  };

  it('returns defaults when no options given', () => {
    expect(resolveGenerateOptions(undefined, defaults)).toEqual(defaults);
  });

  it('overrides only provided fields', () => {
    const r = resolveGenerateOptions({ temperature: 0.3 }, defaults);
    expect(r.temperature).toBe(0.3);
    expect(r.nPredict).toBe(512);
    expect(r.topP).toBe(0.95);
    expect(r.stop).toEqual(['<|eot_id|>']);
  });

  it('ignores the AbortSignal field (not a generation param)', () => {
    const r = resolveGenerateOptions(
      { nPredict: 64, signal: new AbortController().signal },
      defaults,
    );
    expect(r).toEqual({ ...defaults, nPredict: 64 });
    expect('signal' in r).toBe(false);
  });

  it('treats explicit undefined fields as "use default"', () => {
    const r = resolveGenerateOptions({ temperature: undefined }, defaults);
    expect(r.temperature).toBe(0.7);
  });
});
