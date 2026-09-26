import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  GoogleAuthError,
  classifySignInError,
  shouldSignInInsteadOfLink,
  signInErrorCode,
  signInErrorMessageKey,
  type GoogleSignInErrorCode,
} from './google-auth-errors.ts';

// Android's values; the classifier compares whatever the native module hands it.
const statusCodes = {
  SIGN_IN_CANCELLED: '12501',
  IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};
const withCode = (code: string | number) => Object.assign(new Error(String(code)), { code });

describe('classifySignInError', () => {
  test('native statusCodes: silent, unreported', () => {
    assert.deepEqual(classifySignInError(withCode('12501'), statusCodes), { code: 'CANCELLED', report: false });
    assert.deepEqual(classifySignInError(withCode('ASYNC_OP_IN_PROGRESS'), statusCodes), {
      code: 'IN_PROGRESS',
      report: false,
    });
    assert.deepEqual(classifySignInError(withCode('12502'), statusCodes), { code: 'IN_PROGRESS', report: false });
    assert.deepEqual(classifySignInError(withCode('PLAY_SERVICES_NOT_AVAILABLE'), statusCodes), {
      code: 'PLAY_SERVICES_UNAVAILABLE',
      report: false,
    });
  });

  test('Google network codes on both platforms are NETWORK, unreported', () => {
    for (const code of ['7', '-1009', '-1001', '-1005']) {
      assert.deepEqual(classifySignInError(withCode(code), statusCodes), { code: 'NETWORK', report: false }, code);
    }
  });

  test('a numeric code is compared as its string', () => {
    assert.equal(classifySignInError(withCode(7), statusCodes).code, 'NETWORK');
  });

  test('Firebase auth codes', () => {
    const cases: [string, GoogleSignInErrorCode, boolean][] = [
      ['auth/network-request-failed', 'NETWORK', false],
      ['auth/too-many-requests', 'TOO_MANY_REQUESTS', true],
      ['auth/quota-exceeded', 'TOO_MANY_REQUESTS', true],
      ['auth/user-disabled', 'ACCOUNT_UNAVAILABLE', true],
      ['auth/account-exists-with-different-credential', 'ACCOUNT_UNAVAILABLE', true],
    ];
    for (const [raw, code, report] of cases) {
      assert.deepEqual(classifySignInError(withCode(raw), statusCodes), { code, report }, raw);
    }
  });

  test('DEVELOPER_ERROR and anything unrecognised are UNKNOWN and reported', () => {
    assert.deepEqual(classifySignInError(withCode('10'), statusCodes), { code: 'UNKNOWN', report: true });
    assert.deepEqual(classifySignInError(withCode('auth/operation-not-allowed'), statusCodes), {
      code: 'UNKNOWN',
      report: true,
    });
    assert.deepEqual(classifySignInError(new Error('no code'), statusCodes), { code: 'UNKNOWN', report: true });
    assert.deepEqual(classifySignInError('string thrown', statusCodes), { code: 'UNKNOWN', report: true });
    assert.deepEqual(classifySignInError(null, statusCodes), { code: 'UNKNOWN', report: true });
  });

  test('a GoogleAuthError keeps its code; only UNKNOWN (missing idToken) is reported', () => {
    assert.deepEqual(classifySignInError(new GoogleAuthError('DOMAIN_NOT_ALLOWED'), statusCodes), {
      code: 'DOMAIN_NOT_ALLOWED',
      report: false,
    });
    assert.deepEqual(classifySignInError(new GoogleAuthError('UNKNOWN'), statusCodes), {
      code: 'UNKNOWN',
      report: true,
    });
  });
});

describe('shouldSignInInsteadOfLink', () => {
  test('the Google identity already has an account', () => {
    assert.equal(shouldSignInInsteadOfLink(withCode('auth/credential-already-in-use')), true);
    assert.equal(shouldSignInInsteadOfLink(withCode('auth/email-already-in-use')), true);
  });

  // Refusing would keep the dead anonymous user and fail every retry.
  test('the anonymous user is gone or unusable', () => {
    for (const code of ['auth/user-not-found', 'auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token']) {
      assert.equal(shouldSignInInsteadOfLink(withCode(code)), true, code);
    }
  });

  // Falling through on these would sign a new student into a fresh uid and
  // abandon the anonymous one.
  test('a transient or unrelated link failure does not fall back', () => {
    for (const code of ['auth/network-request-failed', 'auth/too-many-requests', 'auth/internal-error']) {
      assert.equal(shouldSignInInsteadOfLink(withCode(code)), false, code);
    }
    assert.equal(shouldSignInInsteadOfLink(new Error('no code')), false);
    assert.equal(shouldSignInInsteadOfLink(undefined), false);
  });
});

describe('signInErrorMessageKey', () => {
  test('cancel and in-progress say nothing', () => {
    assert.equal(signInErrorMessageKey('CANCELLED'), null);
    assert.equal(signInErrorMessageKey('IN_PROGRESS'), null);
  });

  test('every other code has its own message', () => {
    assert.equal(signInErrorMessageKey('DOMAIN_NOT_ALLOWED'), 'auth.domainNotAllowed');
    assert.equal(signInErrorMessageKey('PLAY_SERVICES_UNAVAILABLE'), 'auth.playServicesError');
    assert.equal(signInErrorMessageKey('NETWORK'), 'auth.networkError');
    assert.equal(signInErrorMessageKey('TOO_MANY_REQUESTS'), 'auth.tooManyRequests');
    assert.equal(signInErrorMessageKey('ACCOUNT_UNAVAILABLE'), 'auth.accountUnavailable');
    assert.equal(signInErrorMessageKey('UNKNOWN'), 'auth.unknownError');
  });
});

describe('signInErrorCode', () => {
  test('reads a GoogleAuthError, anything else is UNKNOWN', () => {
    assert.equal(signInErrorCode(new GoogleAuthError('NETWORK')), 'NETWORK');
    assert.equal(signInErrorCode(new Error('boom')), 'UNKNOWN');
  });
});
