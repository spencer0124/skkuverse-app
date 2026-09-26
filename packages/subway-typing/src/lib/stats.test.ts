import { assert, test } from 'vitest';
import { accuracy, formatTime, keyCount, keysPerMinute } from './stats';

test('keyCount sums keys, not characters', () => {
  assert.strictEqual(keyCount(['이촌', '성균관대']), 5 + 12);
});

test('keysPerMinute', () => {
  assert.strictEqual(keysPerMinute(300, 60_000), 300);
  assert.strictEqual(keysPerMinute(100, 30_000), 200);
  assert.strictEqual(keysPerMinute(100, 0), 0);
});

test('accuracy', () => {
  assert.strictEqual(accuracy(100, 0), 100);
  assert.strictEqual(accuracy(99, 1), 99);
  assert.strictEqual(accuracy(0, 0), 100);
});

test('formatTime', () => {
  assert.strictEqual(formatTime(0), '0:00.00');
  assert.strictEqual(formatTime(65_321), '1:05.32');
  assert.strictEqual(formatTime(-5), '0:00.00');
});
