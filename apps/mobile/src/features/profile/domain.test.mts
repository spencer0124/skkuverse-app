import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emailPrefixOf,
  maskedEmail,
  missingSteps,
  parseProfile,
  prefillFromDevice,
  validateNickname,
} from './domain.ts';

describe('validateNickname', () => {
  test('Hangul, Latin, digits and underscore within 2–12 characters', () => {
    for (const n of ['파도', 'wave_rider12', '가나다라마바사아자차카타', 'ab', 'A1_']) {
      assert.equal(validateNickname(n), 'ok', n);
    }
  });
  test('length is counted in characters, surrounding spaces ignored', () => {
    assert.equal(validateNickname('파'), 'tooShort');
    assert.equal(validateNickname('  파  '), 'tooShort');
    assert.equal(validateNickname(''), 'tooShort');
    assert.equal(validateNickname('가나다라마바사아자차카타파'), 'tooLong');
    assert.equal(validateNickname('wave_rider_12'), 'tooLong');
  });
  test('decomposed Hangul (pasted NFD) is composed first', () => {
    assert.equal(validateNickname('파도'.normalize('NFD')), 'ok');
  });
  test('anything outside the set is rejected — same pattern as firestore.rules', () => {
    for (const n of ['wave rider', 'wave!', '파도🌊', 'ㄱㄴㄷ', 'ｗａｖｅ', '파도.']) {
      assert.equal(validateNickname(n), 'invalidChars', n);
    }
  });
});

describe('emailPrefixOf / maskedEmail', () => {
  test('the first three characters of the local part', () => {
    assert.equal(emailPrefixOf('wavekim@g.skku.edu'), 'wav');
    assert.equal(emailPrefixOf('ab@g.skku.edu'), 'ab');
    assert.equal(emailPrefixOf('WaveKim@g.skku.edu'), 'wav');
  });
  test('stops at the first character the rules would not accept', () => {
    assert.equal(emailPrefixOf('a.bc@g.skku.edu'), 'a');
    assert.equal(emailPrefixOf('.abc@g.skku.edu'), null);
    assert.equal(emailPrefixOf(null), null);
    assert.equal(emailPrefixOf('no-at-sign'), null);
  });
  test('masked for display', () => {
    assert.equal(maskedEmail('wav'), 'wav***');
  });
});

describe('parseProfile', () => {
  test('reads a full or partial profile', () => {
    assert.deepEqual(parseProfile({ profile: { campus: 'hssc', nickname: '파도왕' } }), {
      campus: 'hssc',
      nickname: '파도왕',
    });
    assert.deepEqual(parseProfile({ profile: { campus: 'nsc' } }), { campus: 'nsc', nickname: null });
  });
  test('no profile, or an unusable one, is null', () => {
    assert.equal(parseProfile(undefined), null);
    assert.equal(parseProfile({ locale: 'ko' }), null);
    assert.equal(parseProfile({ profile: { campus: 'seoul' } }), null);
    assert.equal(parseProfile({ profile: 'x' }), null);
  });
  test('a malformed nickname reads as absent', () => {
    assert.deepEqual(parseProfile({ profile: { campus: 'hssc', nickname: 7 } }), { campus: 'hssc', nickname: null });
  });
});

describe('missingSteps', () => {
  const full = { campus: 'hssc' as const, nickname: '파도왕' };
  test('no profile: the campus, then the nickname if asked for', () => {
    assert.deepEqual(missingSteps(null, { requireNickname: false }), ['campus']);
    assert.deepEqual(missingSteps(null, { requireNickname: true }), ['campus', 'nickname']);
  });
  test('a full profile asks nothing', () => {
    assert.deepEqual(missingSteps(full, { requireNickname: true }), []);
  });
  test('only the nickname', () => {
    assert.deepEqual(missingSteps({ ...full, nickname: null }, { requireNickname: true }), ['nickname']);
    assert.deepEqual(missingSteps({ ...full, nickname: null }, { requireNickname: false }), []);
  });
});

describe('prefillFromDevice', () => {
  test('a finished notices onboarding suggests its campus', () => {
    assert.deepEqual(prefillFromDevice({ onboardingCompleted: true, preferredCampus: 'nsc' }), { campus: 'nsc' });
  });
  test('otherwise preferredCampus is only a default, so nothing is suggested', () => {
    assert.equal(prefillFromDevice({ onboardingCompleted: false, preferredCampus: 'hssc' }), null);
  });
});
