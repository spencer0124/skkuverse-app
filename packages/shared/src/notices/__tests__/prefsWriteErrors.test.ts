import { describe, it, expect } from 'vitest';
import { isMissingPrefsDocError } from '../prefsWriteErrors';

// Synthesize a Firebase-shaped error.
const fbErr = (code: string) => Object.assign(new Error('mock'), { code });

describe('isMissingPrefsDocError — recoverable (doc may be missing)', () => {
  // 이 케이스가 이 모듈의 존재 이유다. firestore.rules 의 `allow update` 는
  // resource.data 를 역참조하므로 문서가 없으면 룰이 거부하고, 클라이언트는
  // NOT_FOUND 가 아니라 PERMISSION_DENIED 를 받는다. 경험적으로 고정한 곳:
  // apps/mobile/firestore.rules.test.mjs
  //   "update() on a MISSING preferences doc → deny with permission-denied".
  it('treats firestore/permission-denied as recoverable — a missing doc looks like this', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/permission-denied'))).toBe(true);
  });

  it('treats a bare permission-denied (no namespace) as recoverable', () => {
    expect(isMissingPrefsDocError(fbErr('permission-denied'))).toBe(true);
  });

  // not-found 는 실제로는 관측되지 않지만, admin SDK 경로나 향후 룰 변경으로
  // 나타날 수 있으므로 함께 받는다.
  it('treats firestore/not-found as recoverable', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/not-found'))).toBe(true);
  });
});

describe('isMissingPrefsDocError — NOT recoverable', () => {
  // 네트워크 dead spot 에서 문서를 새로 만들지 않기 위한 가드.
  it('rejects firestore/unavailable (network dead spot — do not seed)', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/unavailable'))).toBe(false);
  });

  it('rejects firestore/deadline-exceeded', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/deadline-exceeded'))).toBe(false);
  });

  it('rejects an unrelated code', () => {
    expect(isMissingPrefsDocError(fbErr('firestore/invalid-argument'))).toBe(false);
  });

  it('rejects null / undefined / non-object', () => {
    expect(isMissingPrefsDocError(null)).toBe(false);
    expect(isMissingPrefsDocError(undefined)).toBe(false);
    expect(isMissingPrefsDocError('permission-denied')).toBe(false);
  });

  it('rejects an object with no code, or a non-string code', () => {
    expect(isMissingPrefsDocError({})).toBe(false);
    expect(isMissingPrefsDocError({ code: 42 })).toBe(false);
  });
});
