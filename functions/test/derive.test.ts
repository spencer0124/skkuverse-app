import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSubscribedTopics } from '../src/notifications/derive.ts';
import { FIXED_TAB_KEYS } from '../src/notifications/tabsContract.ts';

const allCategoriesOn = { essential: true, services: true, notices: true };
const allCategoriesOff = { essential: false, services: false, notices: false };
const noTabOverrides: Record<string, boolean> = {};
const noticesOnly = { essential: false, services: false, notices: true };

/**
 * Positional-to-object shim kept deliberately thin: the cases below are about
 * derive's rules, not about its call shape, so they read the same as before the
 * signature moved to an object.
 */
function derive(
  enabled: boolean,
  categoryEnabled: { essential: boolean; services: boolean; notices: boolean },
  noticeTabEnabled: Record<string, boolean>,
  pickerSelections: Record<string, string[]>,
  miniAppSelections?: string[],
): string[] {
  return deriveSubscribedTopics({
    enabled,
    categoryEnabled,
    noticeTabEnabled,
    pickerSelections,
    miniAppSelections,
  });
}

test('master OFF → 빈 배열 (categoryEnabled 다 ON이어도)', () => {
  const result = derive(
    false, allCategoriesOn, noTabOverrides, {
    dept: ['12345'],
    library: ['lib-hssc'],
  });
  assert.deepEqual(result, []);
});

test('master ON, notices만 ON, picker 빈 객체 → 5 fixed 토픽만 (default-on per tab)', () => {
  const result = derive(
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
  const result = derive(
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
  const result = derive(
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
  const result = derive(
    true,
    { essential: true, services: false, notices: false },
    noTabOverrides,
    { dept: ['A'] },
  );
  assert.deepEqual(result, []);
});

test('master ON, 모든 카테고리 OFF → 빈 배열', () => {
  const result = derive(
    true, allCategoriesOff, noTabOverrides, {
    dept: ['A'],
  });
  assert.deepEqual(result, []);
});

test('unknown picker key → 무시되고 known만 emit (drift 방어)', () => {
  const result = derive(
    true,
    { essential: false, services: false, notices: true },
    noTabOverrides,
    { dept: ['A'], club: ['Z'] },
  );
  assert.ok(result.includes('dept:A'));
  assert.ok(!result.includes('club:Z'), 'unknown picker key는 emit 안 됨');
});

test('동일 id 여러 source → Set으로 dedup', () => {
  const result = derive(
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
  const result = derive(
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
  const result = derive(
    true,
    { essential: false, services: false, notices: true },
    { dept: false },
    { dept: ['A', 'B'] },
  );
  assert.equal(result.length, FIXED_TAB_KEYS.length, '5 fixed만');
  assert.ok(!result.some((t) => t.startsWith('dept:')), 'dept 토픽 없음');
});

test('noticeTabEnabled.library=false 인데 dept는 default-on → dept만 emit', () => {
  const result = derive(
    true,
    { essential: false, services: false, notices: true },
    { library: false },
    { dept: ['A'], library: ['lib-hssc'] },
  );
  assert.ok(result.includes('dept:A'));
  assert.ok(!result.some((t) => t.startsWith('library:')), 'library OFF — emit 안 됨');
});

test('noticeTabEnabled.academic=true 명시 → 동작은 default와 동일 (idempotent)', () => {
  const explicit = derive(
    true,
    { essential: false, services: false, notices: true },
    { academic: true },
    {},
  );
  const implicit = derive(
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
  const result = derive(
    true,
    { essential: false, services: false, notices: true },
    allFixedOff,
    { dept: ['A'] },
  );
  assert.deepEqual(result, ['dept:A']);
});

// ── mini-app subscriptions ────────────────────────────────────────
//
// The two properties that make these separate from notice tabs, both from
// docs/reference/miniapp-notification-payload.md.

test('miniAppSelections → miniapp:<id> 토픽', () => {
  const result = derive(true, noticesOnly, noTabOverrides, {}, ['eskara-2026']);
  assert.ok(result.includes('miniapp:eskara-2026'));
});

test('마스터 OFF → 미니앱 구독도 무시 (다른 모든 것과 동일한 게이트)', () => {
  const result = derive(false, allCategoriesOn, noTabOverrides, {}, ['eskara-2026']);
  assert.deepEqual(result, []);
});

test('notices 카테고리 OFF여도 미니앱은 emit — 서로 무관한 제품이라 의도된 동작', () => {
  const result = derive(
    true,
    { essential: false, services: false, notices: false },
    noTabOverrides,
    { dept: ['A'] },
    ['eskara-2026'],
  );
  assert.deepEqual(result, ['miniapp:eskara-2026'], 'notice 토픽은 전부 빠지고 미니앱만 남는다');
});

test('miniAppSelections 부재 → 빈 것과 동일 (필드 이전 문서)', () => {
  const absent = derive(true, noticesOnly, noTabOverrides, {});
  const empty = derive(true, noticesOnly, noTabOverrides, {}, []);
  assert.deepEqual(absent.sort(), empty.sort());
  assert.ok(!absent.some((t) => t.startsWith('miniapp:')));
});

test('미니앱 id 중복 → dedup', () => {
  const result = derive(true, noticesOnly, noTabOverrides, {}, ['a', 'a', 'b']);
  assert.equal(result.filter((t) => t.startsWith('miniapp:')).length, 2);
});

test("falsy id는 필터 — 'miniapp:' 은 invalid topic이라 dispatch 전체를 죽인다", () => {
  const result = derive(true, noticesOnly, noTabOverrides, {}, ['', 'eskara-2026']);
  assert.ok(!result.includes('miniapp:'));
  assert.ok(result.includes('miniapp:eskara-2026'));
});

test('미니앱 + 공지 동시 구독 → 둘 다 emit', () => {
  const result = derive(true, noticesOnly, noTabOverrides, { dept: ['A'] }, ['eskara-2026']);
  assert.ok(result.includes('dept:A'));
  assert.ok(result.includes('miniapp:eskara-2026'));
  assert.equal(result.length, FIXED_TAB_KEYS.length + 2);
});
