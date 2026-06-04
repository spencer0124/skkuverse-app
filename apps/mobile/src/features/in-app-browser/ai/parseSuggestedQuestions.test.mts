import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSuggestedQuestions } from './parseSuggestedQuestions.ts';

test('번호 목록 파싱', () => {
  const raw = '1. 신청 기간은 언제인가요?\n2. 대상은 누구인가요?\n3. 첨부서류는?';
  assert.deepEqual(parseSuggestedQuestions(raw), [
    '신청 기간은 언제인가요?',
    '대상은 누구인가요?',
    '첨부서류는?',
  ]);
});

test('다양한 불릿/번호 마커 제거 (-, •, 1), Q:)', () => {
  const raw = '- 무엇인가요?\n• 어디서 하나요?\n2) 비용은?\nQ: 마감일은?';
  assert.deepEqual(parseSuggestedQuestions(raw), [
    '무엇인가요?',
    '어디서 하나요?',
    '비용은?',
    '마감일은?',
  ]);
});

test('JSON 배열 출력도 허용', () => {
  const raw = '["질문 하나?", "질문 둘?"]';
  assert.deepEqual(parseSuggestedQuestions(raw), ['질문 하나?', '질문 둘?']);
});

test('앞 라벨 라인(콜론 끝)은 버림', () => {
  const raw = '다음은 추천 질문입니다:\n1. 진짜 질문인가요?';
  assert.deepEqual(parseSuggestedQuestions(raw), ['진짜 질문인가요?']);
});

test('감싼 따옴표 제거 + 빈 줄 무시', () => {
  const raw = '\n"질문 A?"\n\n‘질문 B?’\n';
  assert.deepEqual(parseSuggestedQuestions(raw), ['질문 A?', '질문 B?']);
});

test('중복 제거', () => {
  const raw = '1. 같은 질문?\n2. 같은 질문?\n3. 다른 질문?';
  assert.deepEqual(parseSuggestedQuestions(raw), ['같은 질문?', '다른 질문?']);
});

test('max 개수로 제한 (기본 4)', () => {
  const raw = '1. a?\n2. b?\n3. c?\n4. d?\n5. e?\n6. f?';
  assert.equal(parseSuggestedQuestions(raw).length, 4);
  assert.equal(parseSuggestedQuestions(raw, 3).length, 3);
});

test('빈/잡음 입력 → 빈 배열', () => {
  assert.deepEqual(parseSuggestedQuestions(''), []);
  assert.deepEqual(parseSuggestedQuestions('   \n  \n'), []);
});
