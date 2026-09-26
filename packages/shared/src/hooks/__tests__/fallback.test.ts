import { describe, it, expect } from 'vitest';
import { dataOrFallback } from '../fallback';

const FALLBACK = { source: 'fallback' };
const GOOD = { source: 'server' };

describe('dataOrFallback', () => {
  it('is undefined while the first fetch is in flight', () => {
    expect(dataOrFallback({ data: undefined, isError: false }, FALLBACK)).toBeUndefined();
  });

  it('serves the fallback once a fetch failed with no data', () => {
    expect(dataOrFallback({ data: undefined, isError: true }, FALLBACK)).toBe(FALLBACK);
  });

  it('keeps the last good data through a failed refetch', () => {
    expect(dataOrFallback({ data: GOOD, isError: true }, FALLBACK)).toBe(GOOD);
  });

  it('serves the data when the fetch succeeded', () => {
    expect(dataOrFallback({ data: GOOD, isError: false }, FALLBACK)).toBe(GOOD);
  });
});
