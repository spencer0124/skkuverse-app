import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSubscribedTopics } from '../src/notifications/derive.ts';
import { FIXED_TAB_KEYS } from '../src/notifications/tabsContract.ts';

const allCategoriesOn = { essential: true, services: true, notices: true };
const allCategoriesOff = { essential: false, services: false, notices: false };

test('master OFF → 빈 배열 (categoryEnabled 다 ON이어도)', () => {
  const result = deriveSubscribedTopics(false, allCategoriesOn, {
    dept: ['12345'],
    library: ['lib-hssc'],
  });
  assert.deepEqual(result, []);
});

test('master ON, notices만 ON, picker 빈 객체 → 5 fixed 토픽만', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
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
    { dept: ['A'] },
  );
  assert.deepEqual(result, []);
});

test('master ON, 모든 카테고리 OFF → 빈 배열', () => {
  const result = deriveSubscribedTopics(true, allCategoriesOff, {
    dept: ['A'],
  });
  assert.deepEqual(result, []);
});

test('unknown picker key → 무시되고 known만 emit (drift 방어)', () => {
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    { dept: ['A'], club: ['Z'] },
  );
  assert.ok(result.includes('dept:A'));
  assert.ok(!result.includes('club:Z'), 'unknown picker key는 emit 안 됨');
});

test('동일 id 여러 source → Set으로 dedup', () => {
  // 같은 picker 안에서는 자연스레 unique이지만,
  // 미래 multiple source를 가정한 dedup 보장 케이스
  const result = deriveSubscribedTopics(
    true,
    { essential: false, services: false, notices: true },
    { dept: ['A', 'A', 'B'] },
  );
  const deptCount = result.filter((t) => t.startsWith('dept:')).length;
  assert.equal(deptCount, 2, 'A 중복 제거 후 2개');
});
