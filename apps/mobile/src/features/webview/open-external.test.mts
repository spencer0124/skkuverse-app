import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openAppFirst } from './open-external.ts';

// A fake opener that records every URL it is asked to open, and rejects the
// ones listed — the way `Linking.openURL` rejects a scheme nothing handles.
function opener(rejects: string[] = []) {
  const opened: string[] = [];
  const open = async (url: string) => {
    opened.push(url);
    if (rejects.includes(url)) throw new Error('no handler');
  };
  return { opened, open };
}

test('opens the app and stops there when the scheme is handled', async () => {
  const { opened, open } = opener();
  await openAppFirst({ url: 'https://open.spotify.com/track/x', appUrl: 'spotify:track:x' }, open);
  assert.deepEqual(opened, ['spotify:track:x']);
});

test('falls back to the web address when the app scheme is rejected', async () => {
  const { opened, open } = opener(['spotify:track:x']);
  await openAppFirst({ url: 'https://open.spotify.com/track/x', appUrl: 'spotify:track:x' }, open);
  assert.deepEqual(opened, ['spotify:track:x', 'https://open.spotify.com/track/x']);
});

test('opens the web address alone when there is no appUrl', async () => {
  const { opened, open } = opener();
  await openAppFirst({ url: 'https://x.test' }, open);
  assert.deepEqual(opened, ['https://x.test']);
});

test('swallows a failing fallback rather than rejecting', async () => {
  const { open } = opener(['spotify:track:x', 'https://x.test']);
  await assert.doesNotReject(openAppFirst({ url: 'https://x.test', appUrl: 'spotify:track:x' }, open));
});
