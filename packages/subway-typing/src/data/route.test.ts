import { assert, test } from 'vitest';
import { ROUTE, STOP_COUNT } from './route';

const names = ROUTE.map((s) => s.name);

test('혜화 to 성균관대, 28 stations, every one typed', () => {
  assert.strictEqual(names[0], '혜화');
  assert.strictEqual(names.at(-1), '성균관대');
  assert.strictEqual(ROUTE.length, 28);
  assert.strictEqual(STOP_COUNT, 28);
});

test('Line 4 runs to 금정, where the one change onto Line 1 is', () => {
  const change = ROUTE.findIndex((s) => s.transferTo);
  assert.strictEqual(names[change], '금정');
  assert.strictEqual(ROUTE[change]!.transferTo, '1');
  assert.ok(ROUTE.slice(0, change + 1).every((s) => s.line === '4'));
  assert.ok(ROUTE.slice(change + 1).every((s) => s.line === '1'));
  assert.strictEqual(ROUTE.filter((s) => s.transferTo).length, 1);
});

test('names are unique and typeable without symbols', () => {
  assert.strictEqual(new Set(names).size, names.length);
  for (const name of names) assert.match(name, /^[가-힣]+$/);
});
