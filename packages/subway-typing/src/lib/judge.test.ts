import { assert, test } from 'vitest';
import { isStaleCommit, isTypo, judge, slipKind } from './judge';

test('a final consonant waiting to move on is not a typo', () => {
  assert.strictEqual(judge('삳', '사당').status, 'ok');
  assert.strictEqual(judge('동ㄷ', '동대문').status, 'ok');
  assert.strictEqual(judge('성균관댜', '성균관대').status, 'wrong');
});

test('status covers empty, wrong and done', () => {
  assert.strictEqual(judge('', '동대문').status, 'empty');
  assert.strictEqual(judge('동데', '동대문').status, 'wrong');
  assert.strictEqual(judge('동대문', '동대문').status, 'done');
  assert.strictEqual(judge('동대문역', '동대문').status, 'wrong');
});

test('marks settle whole characters and flag the first wrong one', () => {
  assert.deepEqual(judge('사다', '사당').marks, ['hit', 'rest']);
  assert.deepEqual(judge('동데', '동대문').marks, ['hit', 'miss', 'rest']);
  assert.deepEqual(judge('동대문', '동대문').marks, ['hit', 'hit', 'hit']);
});

test('goodKeys counts only the keys still on course', () => {
  assert.strictEqual(judge('동ㄷ', '동대문').goodKeys, 4);
  assert.strictEqual(judge('동데', '동대문').goodKeys, 3);
});

test('a typo is deleting out of a wrong state, once per slip', () => {
  const t = '충무로';
  assert.strictEqual(isTypo(judge('충무ㅗ', t), judge('충무', t)), true);
  // Still wrong after one delete: not yet counted.
  assert.strictEqual(isTypo(judge('충뭉ㅗ', t), judge('충뭉', t)), false);
  // 천지인: ㅈ becomes ㅊ in place, no deletion.
  assert.strictEqual(isTypo(judge('ㅈ', t), judge('ㅊ', t)), false);
});

test('the echo of the last syllable is recognised, real typing is not', () => {
  assert.strictEqual(isStaleCommit('화', '혜화', '동대문'), true);
  assert.strictEqual(isStaleCommit('동', '혜화', '동대문'), false);
  assert.strictEqual(isStaleCommit('', '혜화', '동대문'), false);
  // A tail that happens to start the next name is kept.
  assert.strictEqual(isStaleCommit('문', '동대문', '문산'), false);
});

test('a slip on a two-set keyboard is felt at once', () => {
  assert.strictEqual(slipKind('동데', '동대문'), 'now');
  assert.strictEqual(slipKind('충무ㅗ', '충무로'), 'now');
  // Wrong before the last key: no 천지인 key ever reaches back that far.
  assert.strictEqual(slipKind('통대', '동대문'), 'now');
  // Past the end of the name.
  assert.strictEqual(slipKind('명동ㄱ', '명동'), 'now');
});

test('a 천지인 key on its way to the right one may still be fine', () => {
  // ㅈ pressed again becomes ㅊ.
  assert.strictEqual(slipKind('ㅈ', '충무로'), 'maybe');
  // ㅇ pressed again becomes ㅁ: 사 + ㅇ reads 상 on the way to 삼.
  assert.strictEqual(slipKind('상', '삼각지'), 'maybe');
  // ㅣ, then ㆍ, makes ㅏ.
  assert.strictEqual(slipKind('시', '사당'), 'maybe');
  assert.strictEqual(slipKind('ㅅㆍ', '서울역'), 'maybe');
  // 과: ㅗ then ㅣ reads 괴 before the dot turns it into ㅘ.
  assert.strictEqual(slipKind('괴', '과천'), 'maybe');
  // 대공원: the field reads 유 before the last ㅣ makes 워.
  assert.strictEqual(slipKind('대공유', '대공원'), 'maybe');
});

test('nothing wrong, nothing to feel', () => {
  assert.strictEqual(slipKind('', '혜화'), null);
  assert.strictEqual(slipKind('혜', '혜화'), null);
  assert.strictEqual(slipKind('혜화', '혜화'), null);
});
