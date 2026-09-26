import assert from 'node:assert/strict';
import test from 'node:test';
import { instagramDestination, openInstagramAppFirst } from './instagram.ts';

test('uses a valid Instagram post for the web and native destinations', () => {
  assert.deepEqual(
    instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://www.instagram.com/p/AbCd_12/'),
    { webUrl: 'https://www.instagram.com/p/AbCd_12/', nativeUrl: 'instagram://p/AbCd_12' },
  );
});

test('opens the Instagram profile when no post is supplied', () => {
  assert.deepEqual(instagramDestination('https://instagram.com/skkuverse.app/', null), {
    webUrl: 'https://instagram.com/skkuverse.app/',
    nativeUrl: 'instagram://user?username=skkuverse.app',
  });
});

test('falls back from an invalid post to a valid profile', () => {
  assert.deepEqual(
    instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://example.com/p/not-instagram/'),
    { webUrl: 'https://www.instagram.com/skkuverse.app/', nativeUrl: 'instagram://user?username=skkuverse.app' },
  );
});

test('rejects a malformed profile', () => {
  assert.equal(instagramDestination('https://example.com/skkuverse.app/', null), null);
});

test('leaves the sheet alone when the Instagram app opens', async () => {
  const opened: string[] = [];
  let fellBack = 0;
  await openInstagramAppFirst(
    'instagram://user?username=skkuverse.app',
    async (url) => {
      opened.push(url);
    },
    () => fellBack++,
  );
  assert.deepEqual(opened, ['instagram://user?username=skkuverse.app']);
  assert.equal(fellBack, 0);
});

test('falls back once when the Instagram app will not open', async () => {
  let fellBack = 0;
  await openInstagramAppFirst(
    'instagram://p/AbCd_12',
    () => Promise.reject(new Error('no handler')),
    () => fellBack++,
  );
  assert.equal(fellBack, 1);
});

test('falls back without trying an app when there is no native destination', async () => {
  let tried = 0;
  let fellBack = 0;
  await openInstagramAppFirst(
    null,
    async () => {
      tried++;
    },
    () => fellBack++,
  );
  assert.equal(tried, 0);
  assert.equal(fellBack, 1);
});
