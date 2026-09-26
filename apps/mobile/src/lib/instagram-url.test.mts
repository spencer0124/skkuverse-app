import assert from 'node:assert/strict';
import test from 'node:test';
import { handsOffToOs, instagramDestination, isInstagramUrl } from './instagram-url.ts';

test('recognises https Instagram addresses on every Instagram host', () => {
  assert.equal(isInstagramUrl('https://www.instagram.com/p/AbCd_12/'), true);
  assert.equal(isInstagramUrl('https://instagram.com/skkuverse.app'), true);
  assert.equal(isInstagramUrl('https://m.instagram.com/reel/AbCd_12/'), true);
  assert.equal(isInstagramUrl('https://WWW.INSTAGRAM.COM/skkuverse.app'), true);
});

test('leaves other addresses to the caller', () => {
  assert.equal(isInstagramUrl('http://www.instagram.com/p/AbCd_12/'), false);
  assert.equal(isInstagramUrl('instagram://p/AbCd_12'), false);
  assert.equal(isInstagramUrl('https://instagram.com.example.com/p/AbCd_12/'), false);
  assert.equal(isInstagramUrl('https://www.skkuverse.com/'), false);
  assert.equal(isInstagramUrl('not a url'), false);
});

test('hands a top-frame Instagram load to the OS', () => {
  assert.equal(handsOffToOs({ url: 'https://www.instagram.com/p/AbCd_12/', isTopFrame: true }), true);
  // Android reports top frames only and leaves the flag unset.
  assert.equal(handsOffToOs({ url: 'https://www.instagram.com/p/AbCd_12/' }), true);
});

test('keeps an Instagram embed loading in its iframe', () => {
  assert.equal(handsOffToOs({ url: 'https://www.instagram.com/p/AbCd_12/embed/', isTopFrame: false }), false);
});

test('lets every other load through', () => {
  assert.equal(handsOffToOs({ url: 'https://eskara.miniapp.skkuverse.com/', isTopFrame: true }), false);
  assert.equal(handsOffToOs({ url: 'about:blank' }), false);
});

test('opens a valid post or reel', () => {
  assert.equal(
    instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://www.instagram.com/p/AbCd_12/'),
    'https://www.instagram.com/p/AbCd_12/',
  );
  assert.equal(
    instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://www.instagram.com/reel/AbCd_12/'),
    'https://www.instagram.com/reel/AbCd_12/',
  );
});

test('opens the profile when no post is supplied', () => {
  assert.equal(instagramDestination('https://instagram.com/skkuverse.app/', null), 'https://instagram.com/skkuverse.app/');
});

test('falls back from an invalid post to a valid profile', () => {
  assert.equal(
    instagramDestination('https://www.instagram.com/skkuverse.app/', 'https://example.com/p/not-instagram/'),
    'https://www.instagram.com/skkuverse.app/',
  );
});

test('opens nothing for a malformed profile', () => {
  assert.equal(instagramDestination('https://example.com/skkuverse.app/', null), null);
  assert.equal(instagramDestination('https://www.instagram.com/explore/', null), null);
});
