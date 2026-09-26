import { assert, test } from 'vitest';
import { MIN_RUN_MS, TOTAL_KEYS } from './bound';

test('the floor the rules mirror (subwayTypingMinMs)', () => {
  assert.strictEqual(TOTAL_KEYS, 238);
  assert.strictEqual(MIN_RUN_MS, 9520);
});
