import { assert, test } from 'vitest';
import { isStaleCommit, isTypo, judge } from './judge';

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
