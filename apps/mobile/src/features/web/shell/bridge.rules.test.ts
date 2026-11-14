import { expect, test } from 'vitest';
import { NOTIFY_METHODS, type HostMessage } from '@skkuverse/miniapp/protocol';
import { resolveMiniAppCapabilities } from '../capabilities.rules';
import { dispatchMiniAppMessage, type MiniAppEffects } from './bridge.rules';

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


test('haptic.impact plays the requested style', () => {
  const { calls, outcome } = send({ method: 'haptic.impact', params: { style: 'medium' } });
  expect(outcome).toBe('handled');
  expect(calls).toStrictEqual([['haptic', 'medium']]);
});

test('link.open passes url and appUrl through', () => {
  const { calls } = send({
    method: 'link.open',
    params: { url: 'https://open.spotify.com/track/1', appUrl: 'spotify:track:1' },
  });
  expect(calls).toStrictEqual([['openLink', { url: 'https://open.spotify.com/track/1', appUrl: 'spotify:track:1' }]]);
});

test('map.openPlace and miniapp.open become map / miniapp actions', () => {
  expect(send({ method: 'map.openPlace', params: { place: 'booth:b12' } }).calls).toStrictEqual([
    ['performAction', 'map', 'booth:b12'],
  ]);
  expect(send({ method: 'miniapp.open', params: { target: 'setlist/today' } }).calls).toStrictEqual([
    ['performAction', 'miniapp', 'setlist/today'],
  ]);
});

test('share.open passes url and text through, and drops a non-http url', () => {
  const url = 'https://skkuverse.com/p/m/booth-box/r/bar-72min-sogaeting';
  const { calls, outcome } = send({ method: 'share.open', params: { url, text: '뽑혔어요' } });
  expect(outcome).toBe('handled');
  expect(calls).toStrictEqual([['share', { url, text: '뽑혔어요' }]]);
  expect(send({ method: 'share.open', params: { url: 'skkuverse:///m/booth-box' } }).outcome).toBe('dropped');
});

test('analytics.track, app.ready and shell.set reach their effects', () => {
  expect(send({ method: 'analytics.track', params: { event: 'vote', params: { n: 1 } } }).calls).toStrictEqual([
    ['track', 'vote', { n: 1 }],
  ]);
  expect(send({ method: 'app.ready' }).calls).toStrictEqual([['ready']]);
  expect(send({ method: 'shell.set', params: { header: 'overlay', statusBar: 'light', background: '#101820' } }).calls).toStrictEqual([['setShell', { header: 'overlay', statusBar: 'light', background: '#101820' }]]);
});

test('shell.set cannot change bar, which is layout and manifest-only', () => {
  const { calls } = send({ method: 'shell.set', params: { bar: 'none', statusBar: 'light' } });
  expect(calls).toStrictEqual([['setShell', { statusBar: 'light' }]]);
  // WHY: with nothing valid left the protocol drops the message outright.
  expect(send({ method: 'shell.set', params: { bar: 'none' } }).outcome).toBe('dropped');
});


test('drops every notification from an origin with no grant', () => {
  for (const msg of [
    { method: 'haptic.impact', params: { style: 'light' } },
    { method: 'link.open', params: { url: 'https://evil.test/' } },
    { method: 'map.openPlace', params: { place: 'b1' } },
    { method: 'shell.set', params: { statusBar: 'light' } },
  ]) {
    const { calls, outcome } = send(msg, [], 'https://third-party.example/');
    expect(outcome).toBe('dropped');
    expect(calls, `ran ${msg.method} without a grant`).toStrictEqual([]);
  }
});

test('drops a notification whose method the grant leaves out', () => {
  const { calls, outcome } = send({ method: 'link.open', params: { url: 'https://a.test/' } }, ['haptic.impact']);
  expect(outcome).toBe('dropped');
  expect(calls).toStrictEqual([]);
});


test('drops what the protocol does not parse, without answering', () => {
  const { effects, calls } = recorder();
  for (const data of [
    'not json',
    42,
    JSON.stringify({ method: 'no.such.method', params: {} }),
    JSON.stringify({ method: 'haptic.impact', params: { style: 'huge' } }),
    JSON.stringify({ method: 'link.open', params: { url: 'javascript:alert(1)' } }),
    // WHY: the old v1 bridge shape is not this protocol.
    JSON.stringify({ type: 'web:open-url', url: 'https://a.test/' }),
  ]) {
    expect(dispatchMiniAppMessage({ data, url: PAGE }, NOTIFY_METHODS, effects)).toBe('dropped');
  }
  expect(calls).toStrictEqual([]);
});


const deliveries = (calls: unknown[][]) =>
  calls.filter((c) => c[0] === 'deliver').map((c) => [c[1], c[2]] as [string, HostMessage]);

test('answers a granted request unsupported, to the origin that asked', () => {
  const { calls, outcome } = send({ id: 'r1', method: 'storage.get', params: { key: 'k' } });
  expect(outcome).toBe('unsupported');
  const [[origin, message]] = deliveries(calls);
  expect(origin).toBe(ORIGIN);
  expect('id' in message && message.id === 'r1' && !message.ok && message.error.code).toBe('unsupported');
  expect(calls.length).toBe(1);
});

test('answers a request with a notify method name unsupported too', () => {
  // WHY: a request is a request whatever it names, so it must not run the notification.
  const { calls, outcome } = send({ id: 'r2', method: 'haptic.impact', params: { style: 'light' } });
  expect(outcome).toBe('unsupported');
  expect(calls.filter((c) => c[0] === 'haptic').length).toBe(0);
});

test('answers a request from an ungranted origin denied', () => {
  const { calls, outcome } = send({ id: 'r3', method: 'storage.get' }, [], 'https://third-party.example/p');
  expect(outcome).toBe('denied');
  const [[origin, message]] = deliveries(calls);
  expect(origin).toBe('https://third-party.example');
  expect('ok' in message && !message.ok && 'error' in message && message.error.code).toBe('denied');
});

test('sends no response when the posting URL has no usable origin', () => {
  for (const url of [undefined, 'about:blank', 'not a url']) {
    const { calls, effects } = recorder();
    const data = JSON.stringify({ id: 'r4', method: 'x.y' });
    expect(dispatchMiniAppMessage({ data, url }, [], effects)).toBe('denied');
    expect(calls).toStrictEqual([]);
  }
});

test('drops a request with a malformed id rather than answering it', () => {
  const { calls, outcome } = send({ id: 'has spaces', method: 'x.y' });
  expect(outcome).toBe('dropped');
  expect(calls).toStrictEqual([]);
});

test('drops every game method: a mini-app origin is granted none, and the shell handles none', () => {
  const over = { score: 999, ticks: 1, hit: null, revives: 0, revivesLeft: 0, validator: 'apple-game@1' };
  const granted = resolveMiniAppCapabilities(PAGE, [ORIGIN], { [ORIGIN]: 'eskara-2026' }, 'eskara-2026');
  expect(granted).toStrictEqual(NOTIFY_METHODS);
  for (const msg of [
    { method: 'game.over', params: over },
    { method: 'game.ready', params: {} },
    { method: 'game.start', params: {} },
    { method: 'game.haptic', params: { style: 'success' } },
  ]) {
    expect(send(msg, granted).outcome, msg.method).toBe('dropped');
    expect(send(msg, granted).calls, msg.method).toStrictEqual([]);
  }
  // A grant list that named it by mistake still reaches no effect.
  const { calls, outcome } = send({ method: 'game.over', params: over }, [...NOTIFY_METHODS, 'game.over']);
  expect(outcome).toBe('dropped');
  expect(calls).toStrictEqual([]);
});

/** WHY: one valid notification per method, so a method a newer SDK adds fails here by name until it has a case. */
const VALID_NOTIFICATION: Record<string, unknown> = {
  'haptic.impact': { style: 'medium' },
  'link.open': { url: 'https://open.spotify.com/track/1' },
  'map.openPlace': { place: 'booth:b12' },
  'miniapp.open': { target: 'setlist/today' },
  'share.open': { url: 'https://skkuverse.com/p/x' },
  'analytics.track': { event: 'vote' },
  'app.ready': {},
  'shell.set': { header: 'overlay' },
};

test.each([...NOTIFY_METHODS])('%s, which the SDK grants, is handled', (method) => {
  expect(VALID_NOTIFICATION, `no valid example for ${method}`).toHaveProperty([method]);
  expect(send({ method, params: VALID_NOTIFICATION[method] }).outcome, method).toBe('handled');
});
