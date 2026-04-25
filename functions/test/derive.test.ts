import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSubscribedTopics } from '../src/notifications/derive.ts';
import { FIXED_TAB_KEYS } from '../src/notifications/tabsContract.ts';

const allCategoriesOn = { essential: true, services: true, notices: true };
const allCategoriesOff = { essential: false, services: false, notices: false };
const noTabOverrides: Record<string, boolean> = {};

test('master OFF → 빈 배열 (categoryEnabled 다 ON이어도)', () => {
  const result = deriveSubscribedTopics(false, allCategoriesOn, noTabOverrides, {
    dept: ['12345'],
    library: ['lib-hssc'],
  });
  assert.deepEqual(result, []);
});

test('master ON, notices만 ON, picker 빈 객체 → 5 fixed 토픽만 (default-on per tab)', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    noTabOverrides,
    {},
  );
  assert.equal(result.length, FIXED_TAB_KEYS.length);
  for (const key of FIXED_TAB_KEYS) {
    assert.ok(result.includes(`category:${key}`), `expected category:${key}`);
  }
});

test('master ON, notices ON + dept [A,B] → 5 fixed + 2 dept 토픽', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    noTabOverrides,
    { dept: ['A', 'B'] },
  );
  assert.equal(result.length, FIXED_TAB_KEYS.length + 2);
  assert.ok(result.includes('dept:A'));
  assert.ok(result.includes('dept:B'));
});

test('master ON, notices ON + dorm [X] + general [Y] → 5 fixed + dorm:X + general:Y (regression: v4 dorm/general 미커버 버그 방지)', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    noTabOverrides,
    { dorm: ['X'], general: ['Y'] },
  );
  assert.ok(result.includes('dorm:X'), 'dorm picker emit');
  assert.ok(result.includes('general:Y'), 'general picker emit');
  assert.equal(result.length, FIXED_TAB_KEYS.length + 2);
});

test('master ON, notices OFF, essential ON → 빈 배열 (essential 토픽 미정의)', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: true, services: false, notices: false },
    noTabOverrides,
    { dept: ['A'] },
  );
  assert.deepEqual(result, []);
});

test('master ON, 모든 카테고리 OFF → 빈 배열', () => {
  const result = deriveSubscribedTopics(true, allCategoriesOff, noTabOverrides, {
    dept: ['A'],
  });
  assert.deepEqual(result, []);
});

test('unknown picker key → 무시되고 known만 emit (drift 방어)', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    noTabOverrides,
    { dept: ['A'], club: ['Z'] },
  );
  assert.ok(result.includes('dept:A'));
  assert.ok(!result.includes('club:Z'), 'unknown picker key는 emit 안 됨');
});

test('동일 id 여러 source → Set으로 dedup', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    noTabOverrides,
    { dept: ['A', 'A', 'B'] },
  );
  const deptCount = result.filter((t) => t.startsWith('dept:')).length;
  assert.equal(deptCount, 2, 'A 중복 제거 후 2개');
});

// ── noticeTabEnabled per-tab 게이트 시나리오 ──────────────────────

test('noticeTabEnabled.academic=false → academic만 빠지고 나머지 4 fixed + dept 유지', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    { academic: false },
    { dept: ['A'] },
  );
  assert.ok(!result.includes('category:academic'), 'academic 빠짐');
  assert.ok(result.includes('category:scholarship'));
  assert.ok(result.includes('category:career'));
  assert.ok(result.includes('category:recruitment'));
  assert.ok(result.includes('category:event'));
  assert.ok(result.includes('dept:A'));
  assert.equal(result.length, 5, 'academic 빠진 4 fixed + dept:A');
});

test('noticeTabEnabled.dept=false → dept picker 무시, 5 fixed만', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    { dept: false },
    { dept: ['A', 'B'] },
  );
  assert.equal(result.length, FIXED_TAB_KEYS.length, '5 fixed만');
  assert.ok(!result.some((t) => t.startsWith('dept:')), 'dept 토픽 없음');
});

test('noticeTabEnabled.library=false 인데 dept는 default-on → dept만 emit', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    { library: false },
    { dept: ['A'], library: ['lib-hssc'] },
  );
  assert.ok(result.includes('dept:A'));
  assert.ok(!result.some((t) => t.startsWith('library:')), 'library OFF — emit 안 됨');
});

test('noticeTabEnabled.academic=true 명시 → 동작은 default와 동일 (idempotent)', () => {
  const explicit = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    { academic: true },
    {},
  );
  const implicit = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    {},
    {},
  );
  assert.deepEqual(explicit.sort(), implicit.sort());
});

test('모든 fixed 탭 OFF + dept [A] → dept:A만 emit (notices 카테고리는 ON)', () => {
  const allFixedOff: Record<string, boolean> = {};
  for (const key of FIXED_TAB_KEYS) allFixedOff[key] = false;
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    allFixedOff,
    { dept: ['A'] },
  );
  assert.deepEqual(result, ['dept:A']);
});
