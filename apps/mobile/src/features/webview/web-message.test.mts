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

// `web:open-url` reaches `Linking.openURL`, and `web:haptic`'s style picks the
// impact to play — both now have their fields checked too.

test('parses a web:open-url with and without an appUrl', () => {
  assert.deepEqual(parseWebMessage(JSON.stringify({ type: 'web:open-url', url: 'https://x.test' })), {
    type: 'web:open-url',
    url: 'https://x.test',
  });
  const withApp = { type: 'web:open-url', url: 'https://open.spotify.com/track/x', appUrl: 'spotify:track:x' };
  assert.deepEqual(parseWebMessage(JSON.stringify(withApp)), withApp);
});

for (const [label, payload] of [
  ['a missing url', { type: 'web:open-url' }],
  ['an empty url', { type: 'web:open-url', url: '' }],
  ['an empty appUrl', { type: 'web:open-url', url: 'https://x.test', appUrl: '' }],
  ['a non-string appUrl', { type: 'web:open-url', url: 'https://x.test', appUrl: 1 }],
] as const) {
  test(`refuses a web:open-url with ${label}`, () => {
    assert.equal(parseWebMessage(JSON.stringify(payload)), null);
  });
}

test('parses each web:haptic style and refuses any other', () => {
  for (const style of ['light', 'medium', 'heavy']) {
    assert.equal(parseWebMessage(JSON.stringify({ type: 'web:haptic', style }))?.type, 'web:haptic');
  }
  for (const style of ['rigid', '', undefined, 3]) {
    assert.equal(parseWebMessage(JSON.stringify({ type: 'web:haptic', style })), null);
  }
});

test('refuses an unknown type', () => {
  assert.equal(parseWebMessage(JSON.stringify({ type: 'web:teleport' })), null);
});
