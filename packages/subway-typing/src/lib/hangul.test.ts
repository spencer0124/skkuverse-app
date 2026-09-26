import { assert, test } from 'vitest';
import { isKeyPrefix, toKeys } from './hangul';

test('a syllable splits into the keys that type it', () => {
  assert.deepEqual(toKeys('혜화'), ['ㅎ', 'ㅖ', 'ㅎ', 'ㅗ', 'ㅏ']);
  assert.deepEqual(toKeys('성균관대'), ['ㅅ', 'ㅓ', 'ㅇ', 'ㄱ', 'ㅠ', 'ㄴ', 'ㄱ', 'ㅗ', 'ㅏ', 'ㄴ', 'ㄷ', 'ㅐ']);
});

test('compound vowels and finals are two keys, doubled consonants one', () => {
  assert.deepEqual(toKeys('의'), ['ㅇ', 'ㅡ', 'ㅣ']);
  assert.deepEqual(toKeys('닭'), ['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ']);
  assert.deepEqual(toKeys('까'), ['ㄲ', 'ㅏ']);
});

test('lone jamo mid-composition count as keys too', () => {
  assert.deepEqual(toKeys('동ㄷ'), ['ㄷ', 'ㅗ', 'ㅇ', 'ㄷ']);
  assert.deepEqual(toKeys('ㅘ'), ['ㅗ', 'ㅏ']);
});

test('decomposed (NFD) input reads the same as composed', () => {
  assert.deepEqual(toKeys('사당'.normalize('NFD')), toKeys('사당'));
});

test('isKeyPrefix', () => {
  assert.strictEqual(isKeyPrefix(toKeys('삳'), toKeys('사당')), true);
  assert.strictEqual(isKeyPrefix(toKeys('사당역'), toKeys('사당')), false);
  assert.strictEqual(isKeyPrefix([], toKeys('사당')), true);
});
