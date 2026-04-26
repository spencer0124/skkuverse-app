import { describe, it, expect } from 'vitest';
import { bookmarkKey, parseBookmarkKey } from '../bookmarks';

describe('bookmarkKey', () => {
  it('produces ${sourceId}:${articleNo}', () => {
    expect(bookmarkKey('cse-undergrad', 5847)).toBe('cse-undergrad:5847');
  });

  it('preserves hyphens in sourceId', () => {
    expect(bookmarkKey('arch-undergrad', 1)).toBe('arch-undergrad:1');
  });
});

describe('parseBookmarkKey', () => {
  it('roundtrips with bookmarkKey', () => {
    const k = bookmarkKey('cse-undergrad', 5847);
    expect(parseBookmarkKey(k)).toEqual({ sourceId: 'cse-undergrad', articleNo: 5847 });
  });

  it('returns null for empty string', () => {
    expect(parseBookmarkKey('')).toBeNull();
  });

  it('returns null for missing colon', () => {
    expect(parseBookmarkKey('cse-undergrad5847')).toBeNull();
  });

  it('returns null for leading colon (empty sourceId)', () => {
    expect(parseBookmarkKey(':5847')).toBeNull();
  });

  it('returns null for trailing colon (empty articleNo)', () => {
    expect(parseBookmarkKey('cse-undergrad:')).toBeNull();
  });

  it('returns null for non-numeric articleNo', () => {
    expect(parseBookmarkKey('cse-undergrad:abc')).toBeNull();
  });

  it('returns null for float articleNo (not integer)', () => {
    expect(parseBookmarkKey('cse-undergrad:5847.5')).toBeNull();
  });

  it('returns null for zero articleNo', () => {
    expect(parseBookmarkKey('cse-undergrad:0')).toBeNull();
  });

  it('returns null for negative articleNo', () => {
    expect(parseBookmarkKey('cse-undergrad:-5')).toBeNull();
  });

  it('splits at last colon when sourceId itself contains colon', () => {
    // Defensive: if a malformed sourceId ever gets stored, lastIndexOf split
    // means parser still extracts the trailing articleNo correctly.
    expect(parseBookmarkKey('a:b:1')).toEqual({ sourceId: 'a:b', articleNo: 1 });
  });

  it('accepts large positive articleNo', () => {
    expect(parseBookmarkKey('skku-main:136023')).toEqual({
      sourceId: 'skku-main',
      articleNo: 136023,
    });
  });
});
