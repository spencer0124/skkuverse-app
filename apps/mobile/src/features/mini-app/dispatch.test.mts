import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFY_METHODS, type HostMessage } from '@skkuverse/miniapp/protocol';
import { dispatchMiniAppMessage, type MiniAppEffects } from './dispatch.ts';

const PAGE = 'https://eskara.miniapp.skkuverse.com/booths?x=1';
const ORIGIN = 'https://eskara.miniapp.skkuverse.com';

/** Effects that record every call as `[name, ...args]`. */
function recorder() {
  const calls: unknown[][] = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const effects: MiniAppEffects = {
    haptic: rec('haptic'),
    openLink: rec('openLink'),
    performAction: rec('performAction'),
    share: rec('share'),
    track: rec('track'),
    ready: rec('ready'),
    setShell: rec('setShell'),
    deliver: rec('deliver'),
  };
  return { calls, effects };
}

const send = (msg: unknown, granted: readonly string[] = NOTIFY_METHODS, url: string | undefined = PAGE) => {
  const { calls, effects } = recorder();
  const outcome = dispatchMiniAppMessage({ data: JSON.stringify(msg), url }, granted, effects);
  return { calls, outcome };
};

// ── Notifications, granted ──

test('haptic.impact plays the requested style', () => {
  const { calls, outcome } = send({ method: 'haptic.impact', params: { style: 'medium' } });
  assert.equal(outcome, 'handled');
  assert.deepEqual(calls, [['haptic', 'medium']]);
});

test('link.open passes url and appUrl through', () => {
  const { calls } = send({
    method: 'link.open',
    params: { url: 'https://open.spotify.com/track/1', appUrl: 'spotify:track:1' },
  });
  assert.deepEqual(calls, [['openLink', { url: 'https://open.spotify.com/track/1', appUrl: 'spotify:track:1' }]]);
});

test('map.openPlace and miniapp.open become map / miniapp actions', () => {
  assert.deepEqual(send({ method: 'map.openPlace', params: { place: 'booth:b12' } }).calls, [
    ['performAction', 'map', 'booth:b12'],
  ]);
  assert.deepEqual(send({ method: 'miniapp.open', params: { target: 'setlist/today' } }).calls, [
    ['performAction', 'miniapp', 'setlist/today'],
  ]);
});

test('share.open passes url and text through, and drops a non-http url', () => {
  const url = 'https://skkuverse.com/p/m/booth-box/r/bar-72min-sogaeting';
  const { calls, outcome } = send({ method: 'share.open', params: { url, text: '뽑혔어요' } });
  assert.equal(outcome, 'handled');
  assert.deepEqual(calls, [['share', { url, text: '뽑혔어요' }]]);
  assert.equal(send({ method: 'share.open', params: { url: 'skkuverse:///m/booth-box' } }).outcome, 'dropped');
});

test('analytics.track, app.ready and shell.set reach their effects', () => {
  assert.deepEqual(send({ method: 'analytics.track', params: { event: 'vote', params: { n: 1 } } }).calls, [
    ['track', 'vote', { n: 1 }],
  ]);
  assert.deepEqual(send({ method: 'app.ready' }).calls, [['ready']]);
  assert.deepEqual(
    send({ method: 'shell.set', params: { header: 'overlay', statusBar: 'light', background: '#101820' } }).calls,
    [['setShell', { header: 'overlay', statusBar: 'light', background: '#101820' }]],
  );
});

test('shell.set cannot change bar, which is layout and manifest-only', () => {
  const { calls } = send({ method: 'shell.set', params: { bar: 'none', statusBar: 'light' } });
  assert.deepEqual(calls, [['setShell', { statusBar: 'light' }]]);
  // Nothing valid left → the protocol drops the message outright.
  assert.equal(send({ method: 'shell.set', params: { bar: 'none' } }).outcome, 'dropped');
});

// ── Notifications, not granted ──

test('drops every notification from an origin with no grant', () => {
  for (const msg of [
    { method: 'haptic.impact', params: { style: 'light' } },
    { method: 'link.open', params: { url: 'https://evil.test/' } },
    { method: 'map.openPlace', params: { place: 'b1' } },
    { method: 'shell.set', params: { statusBar: 'light' } },
  ]) {
    const { calls, outcome } = send(msg, [], 'https://third-party.example/');
    assert.equal(outcome, 'dropped');
    assert.deepEqual(calls, [], `ran ${msg.method} without a grant`);
  }
});

test('drops a notification whose method the grant leaves out', () => {
  const { calls, outcome } = send({ method: 'link.open', params: { url: 'https://a.test/' } }, ['haptic.impact']);
  assert.equal(outcome, 'dropped');
  assert.deepEqual(calls, []);
});

// ── Malformed input ──

test('drops what the protocol does not parse, without answering', () => {
  const { effects, calls } = recorder();
  for (const data of [
    'not json',
    42,
    JSON.stringify({ method: 'no.such.method', params: {} }),
    JSON.stringify({ method: 'haptic.impact', params: { style: 'huge' } }),
    JSON.stringify({ method: 'link.open', params: { url: 'javascript:alert(1)' } }),
    // The old v1 bridge shape is not this protocol.
    JSON.stringify({ type: 'web:open-url', url: 'https://a.test/' }),
  ]) {
    assert.equal(dispatchMiniAppMessage({ data, url: PAGE }, NOTIFY_METHODS, effects), 'dropped');
  }
  assert.deepEqual(calls, []);
});

// ── Requests ──

const deliveries = (calls: unknown[][]) =>
  calls.filter((c) => c[0] === 'deliver').map((c) => [c[1], c[2]] as [string, HostMessage]);

test('answers a granted request unsupported, to the origin that asked', () => {
  const { calls, outcome } = send({ id: 'r1', method: 'storage.get', params: { key: 'k' } });
  assert.equal(outcome, 'unsupported');
  const [[origin, message]] = deliveries(calls);
  assert.equal(origin, ORIGIN);
  assert.equal(message.id === 'r1' && !message.ok && message.error.code, 'unsupported');
  assert.equal(calls.length, 1);
});

test('answers a request with a notify method name unsupported too', () => {
  // A request is a request whatever it names; it must not run the notification.
  const { calls, outcome } = send({ id: 'r2', method: 'haptic.impact', params: { style: 'light' } });
  assert.equal(outcome, 'unsupported');
  assert.equal(calls.filter((c) => c[0] === 'haptic').length, 0);
});

test('answers a request from an ungranted origin denied', () => {
  const { calls, outcome } = send({ id: 'r3', method: 'storage.get' }, [], 'https://third-party.example/p');
  assert.equal(outcome, 'denied');
  const [[origin, message]] = deliveries(calls);
  assert.equal(origin, 'https://third-party.example');
  assert.equal(!message.ok && 'error' in message && message.error.code, 'denied');
});

test('sends no response when the posting URL has no usable origin', () => {
  for (const url of [undefined, 'about:blank', 'not a url']) {
    const { calls, effects } = recorder();
    const data = JSON.stringify({ id: 'r4', method: 'x.y' });
    assert.equal(dispatchMiniAppMessage({ data, url }, [], effects), 'denied');
    assert.deepEqual(calls, []);
  }
});

test('drops a request with a malformed id rather than answering it', () => {
  const { calls, outcome } = send({ id: 'has spaces', method: 'x.y' });
  assert.equal(outcome, 'dropped');
  assert.deepEqual(calls, []);
});
