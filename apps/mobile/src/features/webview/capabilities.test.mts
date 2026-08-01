import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
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
