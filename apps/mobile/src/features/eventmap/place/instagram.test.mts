import assert from 'node:assert/strict';
import test from 'node:test';
import { instagramDestination } from './instagram.ts';

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
