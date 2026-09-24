import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebMessage } from '../../../../../packages/bridge/src/receiver.ts';

// `web:action` is the first message whose payload the receiver checks: its
// fields go straight to an allowlist that expects strings, so a message one
// field short must be refused here rather than reach it.

test('parses a well-formed web:action', () => {
  const msg = parseWebMessage(
    JSON.stringify({ type: 'web:action', actionType: 'map', actionValue: 'event:x' }),
  );
  assert.deepEqual(msg, { type: 'web:action', actionType: 'map', actionValue: 'event:x' });
});

for (const [label, payload] of [
  ['a missing actionValue', { type: 'web:action', actionType: 'map' }],
  ['a non-string actionValue', { type: 'web:action', actionType: 'map', actionValue: 31 }],
  ['an empty actionType', { type: 'web:action', actionType: '', actionValue: 'event:x' }],
  ['an object actionType', { type: 'web:action', actionType: {}, actionValue: 'event:x' }],
] as const) {
  test(`refuses a web:action with ${label}`, () => {
    assert.equal(parseWebMessage(JSON.stringify(payload)), null);
  });
}

test('still parses the older messages it never checked the payload of', () => {
  const msg = parseWebMessage(JSON.stringify({ type: 'web:open-url', url: 'https://x.test' }));
  assert.equal(msg?.type, 'web:open-url');
});

test('refuses an unknown type', () => {
  assert.equal(parseWebMessage(JSON.stringify({ type: 'web:teleport' })), null);
});
