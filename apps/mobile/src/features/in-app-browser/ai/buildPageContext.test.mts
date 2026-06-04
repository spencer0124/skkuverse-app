import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPageContext, PAGE_CONTEXT_CHAR_BUDGET } from './buildPageContext.ts';

test('short text → 제목 헤더 + 본문 그대로', () => {
  const out = buildPageContext('공지 제목', '본문 내용입니다.');
  assert.equal(out, '제목: 공지 제목\n\n본문 내용입니다.');
});

test('공백/개행 정규화: 공백 런 축소 + 3개 이상 개행 → 2개', () => {
  const out = buildPageContext('T', 'a    b\n\n\n\nc');
  assert.equal(out, '제목: T\n\na b\n\nc');
});

test('빈 제목이면 제목 라인 없음', () => {
  const out = buildPageContext('', '본문만 있음');
  assert.equal(out, '본문만 있음');
});

test('빈 본문이면 제목 헤더만(트레일링 없음)', () => {
  const out = buildPageContext('제목뿐', '');
  assert.equal(out, '제목: 제목뿐');
});

test('예산 초과 시 잘림 + … , 길이 ≤ 예산', () => {
  const longText = 'A'.repeat(20_000);
  const budget = 100;
  const out = buildPageContext('T', longText, budget);
  assert.ok(out.length <= budget, `len ${out.length} <= ${budget}`);
  assert.ok(out.endsWith('…'), 'ends with ellipsis');
  assert.ok(out.startsWith('제목: T'), 'keeps title header');
});

test('기본 예산 상수는 8000 (n_ctx=8192 종속)', () => {
  assert.equal(PAGE_CONTEXT_CHAR_BUDGET, 8000);
});
