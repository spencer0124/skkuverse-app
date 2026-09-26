import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFY_METHODS } from '@skkuverse/miniapp/protocol';
import {
  bridgedOrigin,
  resolveMiniAppCapabilities,
  resolveWebviewCapabilities,
  FIRST_PARTY_CAPABILITIES,
} from './capabilities.ts';

const ALLOWED = ['https://webview.skkuuniverse.com'];

test('grants the first-party set to an allowlisted origin', () => {
  const caps = resolveWebviewCapabilities(
    'https://webview.skkuuniverse.com/#/skku/lostandfound',
    ALLOWED,
  );
  assert.deepEqual([...caps], [...FIRST_PARTY_CAPABILITIES]);
});

test('ignores path, query and hash when matching the origin', () => {
  const caps = resolveWebviewCapabilities(
    'https://webview.skkuuniverse.com/deep/path?a=1#/bus/hssc/info',
    ALLOWED,
  );
  assert.equal(caps.length, FIRST_PARTY_CAPABILITIES.length);
});

test('grants nothing to a notice source page', () => {
  // The case this whole gate exists for: an arbitrary university page now
  // reaches this screen, and must not be able to drive the app.
  const caps = resolveWebviewCapabilities(
    'https://www.skku.edu/skku/campus/skk_comm/notice.do',
    ALLOWED,
  );
  assert.deepEqual([...caps], []);
});

test('grants nothing after the page navigates off the allowed origin', () => {
  // A grant made when the screen opened would still be live here. Resolving
  // per message from nativeEvent.url is what prevents that.
  const caps = resolveWebviewCapabilities('https://evil.test/landing', ALLOWED);
  assert.deepEqual([...caps], []);
});

test('does not match a look-alike host', () => {
  for (const url of [
    'https://webview.skkuuniverse.com.evil.test/',
    'https://evil.test/?x=https://webview.skkuuniverse.com',
    'https://notwebview.skkuuniverse.com/',
    'https://sub.webview.skkuuniverse.com/',
  ]) {
    assert.deepEqual(
      [...resolveWebviewCapabilities(url, ALLOWED)],
      [],
      `should not grant: ${url}`,
    );
  }
});

test('treats http as a different origin from https', () => {
  // Origin comparison includes the scheme, so a downgraded page loses the
  // bridge rather than inheriting it.
  const caps = resolveWebviewCapabilities(
    'http://webview.skkuuniverse.com/',
    ALLOWED,
  );
  assert.deepEqual([...caps], []);
});

test('treats a non-default port as a different origin', () => {
  const caps = resolveWebviewCapabilities(
    'https://webview.skkuuniverse.com:8443/',
    ALLOWED,
  );
  assert.deepEqual([...caps], []);
});

test('grants nothing when the allowlist is empty (fail-closed)', () => {
  // Config never fetched, fetch failed, or the server sent none.
  const caps = resolveWebviewCapabilities(
    'https://webview.skkuuniverse.com/',
    [],
  );
  assert.deepEqual([...caps], []);
});

test('grants nothing for an undefined or unparseable url', () => {
  assert.deepEqual([...resolveWebviewCapabilities(undefined, ALLOWED)], []);
  assert.deepEqual([...resolveWebviewCapabilities('', ALLOWED)], []);
  assert.deepEqual([...resolveWebviewCapabilities('not a url', ALLOWED)], []);
});

test('grants nothing for opaque origins that stringify to "null"', () => {
  // `new URL('data:...').origin === 'null'`. If "null" ever entered the
  // allowlist this would otherwise match.
  for (const url of ['data:text/html,<h1>hi</h1>', 'about:blank']) {
    assert.deepEqual([...resolveWebviewCapabilities(url, ALLOWED)], []);
    assert.deepEqual([...resolveWebviewCapabilities(url, ['null'])], []);
  }
});

test('never grants web:navigate', () => {
  // Our SPA has never sent it, and the old handler ran router.push() on it
  // unguarded. Regression guard against it being re-added without a path
  // allowlist.
  const caps = resolveWebviewCapabilities(
    'https://webview.skkuuniverse.com/',
    ALLOWED,
  );
  assert.equal(caps.includes('web:navigate'), false);
});

test('grants web:haptic to a first-party page only', () => {
  // The setlist mini app's counter buzzes the phone through it. A notice
  // source page must not be able to.
  assert.equal(
    resolveWebviewCapabilities('https://webview.skkuuniverse.com/', ALLOWED).includes('web:haptic'),
    true,
  );
  assert.equal(
    resolveWebviewCapabilities('https://www.skku.edu/notice.do', ALLOWED).includes('web:haptic'),
    false,
  );
});

test('bridgedOrigin returns the matched origin, or null', () => {
  assert.equal(
    bridgedOrigin('https://webview.skkuuniverse.com/a?b#c', ALLOWED),
    'https://webview.skkuuniverse.com',
  );
  assert.equal(bridgedOrigin('https://evil.test/', ALLOWED), null);
  assert.equal(bridgedOrigin('data:text/html,x', ['null']), null);
  assert.equal(bridgedOrigin(undefined, ALLOWED), null);
});

// ── Mini-app shell: the miniapp protocol's methods over the same gate ──

const MINIAPP_ALLOWED = ['https://eskara.miniapp.skkuverse.com'];

test('grants every miniapp notify method to an allowlisted mini-app origin', () => {
  const caps = resolveMiniAppCapabilities('https://eskara.miniapp.skkuverse.com/booths', MINIAPP_ALLOWED);
  assert.deepEqual([...caps], [...NOTIFY_METHODS]);
});

test('grants a mini-app page nothing off the allowlist, or with none fetched', () => {
  for (const [url, allowed] of [
    ['https://third-party.example/', MINIAPP_ALLOWED],
    ['https://eskara.miniapp.skkuverse.com.evil.test/', MINIAPP_ALLOWED],
    ['http://eskara.miniapp.skkuverse.com/', MINIAPP_ALLOWED],
    ['https://eskara.miniapp.skkuverse.com/', []],
    [undefined, MINIAPP_ALLOWED],
    ['about:blank', ['null']],
  ] as const) {
    assert.deepEqual([...resolveMiniAppCapabilities(url, allowed)], [], `should not grant: ${url}`);
  }
});
