import { describe, it, expect } from 'vitest';
import { classifyBookmarkToggleError } from '../bookmarkErrors';

// Synthesize a Firebase-shaped error.
const fbErr = (code: string) => Object.assign(new Error('mock'), { code });

describe('classifyBookmarkToggleError — permanent codes', () => {
  it('classifies firestore/permission-denied as permanent', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/permission-denied'))).toBe(
      'permanent',
    );
  });

  it('classifies firestore/invalid-argument as permanent (Rules regex/type rejection)', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/invalid-argument'))).toBe(
      'permanent',
    );
  });

  it('classifies firestore/failed-precondition as permanent (missing index)', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/failed-precondition'))).toBe(
      'permanent',
    );
  });

  it('classifies firestore/unauthenticated as permanent (App Check failure surface)', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/unauthenticated'))).toBe(
      'permanent',
    );
  });

  it('classifies bare permission-denied (no namespace) as permanent', () => {
    expect(classifyBookmarkToggleError(fbErr('permission-denied'))).toBe('permanent');
  });
});

describe('classifyBookmarkToggleError — transient codes', () => {
  it('classifies firestore/unavailable as transient (offline queue retries)', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/unavailable'))).toBe(
      'transient',
    );
  });

  it('classifies firestore/deadline-exceeded as transient (timeout, retries)', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/deadline-exceeded'))).toBe(
      'transient',
    );
  });

  it('classifies firestore/cancelled as transient', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/cancelled'))).toBe(
      'transient',
    );
  });

  it('classifies firestore/unknown as transient (default-safe — do not revert blindly)', () => {
    expect(classifyBookmarkToggleError(fbErr('firestore/unknown'))).toBe('transient');
  });
});

describe('classifyBookmarkToggleError — non-Firebase shapes', () => {
  it('returns transient for plain Error without code', () => {
    expect(classifyBookmarkToggleError(new Error('something broke'))).toBe(
      'transient',
    );
  });

  it('returns transient for null', () => {
    expect(classifyBookmarkToggleError(null)).toBe('transient');
  });

  it('returns transient for undefined', () => {
    expect(classifyBookmarkToggleError(undefined)).toBe('transient');
  });

  it('returns transient for string', () => {
    expect(classifyBookmarkToggleError('something broke')).toBe('transient');
  });

  it('returns transient for object with non-string code', () => {
    expect(classifyBookmarkToggleError({ code: 7 })).toBe('transient');
  });
});
