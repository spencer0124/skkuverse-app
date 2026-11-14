/**
 * The hosted game page (docs/explanation/in-app-games.md, "Hosting a page on
 * its game origin": grants by origin, per message, and a handshake that
 * survives a replaced document): what the
 * host hears from it, what it tells it, where it may go, and the handshake
 * driven through a fake web view that runs the real bootstrap and delivery
 * scripts.
 */
import { describe, expect, it, test } from 'vitest';
import {
  GAME_NOTIFY_METHODS,
  GAME_PROTOCOL,
  MESSAGE_EVENT,
  NOTIFY_METHODS,
  parseGameEvent,
  type GameEventMessage,
  type GameRect,
  type Viewport,
} from '@skkuverse/miniapp/protocol';
import { acceptsOver, initialPageRun, initialSession, pageRunAfter, sessionReducer, submitValidator, type GamePageMessage } from './host.rules';
import {
  GAME_GRANTS,
  hostedBootstrapScript,
  hostedEvent,
  hostedLink,
  hostedViewport,
  initialPageLoad,
  isHostedNavigation,
  pageLoadAfter,
  readHostedMessage,
  type HostCommand,
} from './page.rules';

const ORIGIN = 'https://apple-game.game.skkuverse.com';
const PAGE = `${ORIGIN}/`;
const RECT: GameRect = { x: 24, y: 300, width: 340, height: 400 };

const readFrom = (url: string | undefined, msg: unknown) => readHostedMessage({ data: JSON.stringify(msg), url }, ORIGIN);
const read = (msg: unknown) => readFrom(PAGE, msg);

describe('GAME_GRANTS', () => {
  test('are the game notifications, and no mini-app method', () => {
    expect(GAME_GRANTS).toStrictEqual(GAME_NOTIFY_METHODS);
    for (const method of NOTIFY_METHODS) expect(GAME_GRANTS as readonly string[]).not.toContain(method);
  });
});

describe('readHostedMessage', () => {
  it.each<[string, unknown, GamePageMessage, GameRect | null]>([
    ['game.ready with its rectangle', { method: 'game.ready', params: { rect: RECT } }, { type: 'game:ready' }, RECT],
    ['game.ready without one', { method: 'game.ready', params: {} }, { type: 'game:ready' }, null],
    ['game.ready with a malformed one, dropped alone', { method: 'game.ready', params: { rect: { x: 1 } } }, { type: 'game:ready' }, null],
    ['game.start', { method: 'game.start', params: {} }, { type: 'game:start' }, null],
    ['game.phase', { method: 'game.phase', params: { phase: 'paused' } }, { type: 'game:phase', phase: 'paused' }, null],
    ['game.haptic', { method: 'game.haptic', params: { style: 'success' } }, { type: 'game:haptic', style: 'success' }, null],
  ])('reads %s into the session machine', (_name, msg, message, rect) => {
    expect(read(msg)).toStrictEqual({ kind: 'page', message, rect });
  });

  test('game.over keeps the validator, the stats and the telemetry', () => {
    const over = {
      score: 120,
      ticks: 3600,
      hit: 'timeout',
      revives: 0,
      revivesLeft: 0,
      validator: 'apple-game@1',
      stats: { apples: 40 },
      telemetry: { hidden: 1 },
    };
    expect(read({ method: 'game.over', params: over })).toStrictEqual({
      kind: 'page',
      message: { type: 'game:over', ...over },
      rect: null,
    });
  });

  test('game.over without a validator carries none', () => {
    const over = { score: 3, ticks: 10, hit: null, revives: 0, revivesLeft: 1 };
    expect(read({ method: 'game.over', params: over })).toStrictEqual({ kind: 'page', message: { type: 'game:over', ...over }, rect: null });
  });

  test('game.layout moves the rectangle', () => {
    expect(read({ method: 'game.layout', params: { rect: RECT } })).toStrictEqual({ kind: 'layout', rect: RECT });
    expect(read({ method: 'game.layout', params: { rect: { ...RECT, width: -1 } } })).toStrictEqual({ kind: 'dropped' });
  });

  it.each([
    ['another site', 'https://example.com/'],
    ['a mini-app origin', 'https://eskara.miniapp.skkuverse.com/'],
    ['another game', 'https://suika-game.game.skkuverse.com/'],
    ['the same host over http', 'http://apple-game.game.skkuverse.com/'],
    ['an opaque origin', 'about:blank'],
    ['no URL at all', undefined],
  ])('drops a message from %s', (_name, url) => {
    expect(readFrom(url, { method: 'game.over', params: { score: 1, ticks: 1, hit: null, revives: 0, revivesLeft: 0 } })).toStrictEqual({
      kind: 'dropped',
    });
    expect(readFrom(url, { id: 'r1', method: 'game.whatever', params: {} })).toStrictEqual({ kind: 'dropped' });
  });

  test('a legacy game:over from a hosted page is dropped', () => {
    expect(read({ type: 'game:over', score: 999, ticks: 1, hit: null, revives: 0, revivesLeft: 0 })).toStrictEqual({ kind: 'dropped' });
    expect(read({ type: 'game:ready' })).toStrictEqual({ kind: 'dropped' });
  });

  test('a mini-app method from the game origin is dropped', () => {
    expect(read({ method: 'link.open', params: { url: 'https://example.com' } })).toStrictEqual({ kind: 'dropped' });
    expect(read({ method: 'haptic.impact', params: { style: 'light' } })).toStrictEqual({ kind: 'dropped' });
  });

  test('a request is answered unsupported', () => {
    expect(read({ id: 'r1', method: 'game.submit', params: {} })).toStrictEqual({
      kind: 'reply',
      message: { id: 'r1', ok: false, error: { code: 'unsupported', message: 'Unknown method: game.submit' } },
    });
  });
});

/** WHY: one valid notification per method, so a method a newer SDK adds fails here by name until it has a case. */
const VALID_GAME_NOTIFICATION: Record<string, unknown> = {
  'game.ready': {},
  'game.start': {},
  'game.phase': { phase: 'paused' },
  'game.haptic': { style: 'success' },
  'game.layout': { rect: RECT },
  'game.over': { score: 120, ticks: 3600, hit: 'timeout', revives: 0, revivesLeft: 0 },
};

describe('every granted game method', () => {
  test.each([...GAME_NOTIFY_METHODS])('%s is handled', (method) => {
    expect(VALID_GAME_NOTIFICATION, `no valid example for ${method}`).toHaveProperty([method]);
    expect(read({ method, params: VALID_GAME_NOTIFICATION[method] }).kind, method).not.toBe('dropped');
  });
});

describe('isHostedNavigation', () => {
  it.each([
    [PAGE, true],
    [`${ORIGIN}/assets/index.js?v=2#x`, true],
    ['https://example.com', false],
    ['https://example.com/?u=https://apple-game.game.skkuverse.com/', false],
    ['http://apple-game.game.skkuverse.com/', false],
    ['https://apple-game.game.skkuverse.com:8443/', false],
    ['about:blank', false],
    ['data:text/html,<p>hi</p>', false],
    ['skkuverse:///home', false],
    ['not a url', false],
  ])('%s → %s', (url, allowed) => {
    expect(isHostedNavigation(url, ORIGIN)).toBe(allowed);
  });
});

describe('host commands', () => {
  it.each<[HostCommand, unknown]>([
    [{ type: 'init', hi: 42, sound: true }, { event: 'game.init', data: { gameProtocol: GAME_PROTOCOL, hi: 42, sound: true } }],
    [{ type: 'init', hi: 0, sound: null }, { event: 'game.init', data: { gameProtocol: GAME_PROTOCOL, hi: 0, sound: false } }],
    [{ type: 'pause' }, { event: 'game.pause', data: {} }],
    [{ type: 'resume' }, { event: 'game.resume', data: {} }],
    [{ type: 'sound', on: false }, { event: 'game.sound', data: { on: false } }],
    [{ type: 'reset' }, { event: 'game.reset', data: {} }],
    [{ type: 'restart' }, { event: 'game.restart', data: {} }],
    [{ type: 'revive' }, { event: 'game.revive', data: {} }],
  ])('%o: one game.* event to the page', (command, hosted) => {
    expect(hostedEvent(command)).toStrictEqual(hosted);
    // What a hosted page's SDK reads back is what was meant.
    expect(parseGameEvent(hosted)).toStrictEqual(hosted);
  });
});

describe('hostedViewport', () => {
  test('is the device safe area, rounded, with nothing app-drawn over the page', () => {
    expect(hostedViewport({ top: 59.4, bottom: 34, left: 0, right: -1 })).toStrictEqual({
      safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
      contentSafeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      chrome: 'opaque',
    });
  });
});

// ── A fake web view ──────────────────────────────────────────────────

type Listener = (e: { type: string; detail: unknown }) => void;

/**
 * One document in the web view: a window with the React Native bridge, the
 * DOM parts the host's scripts touch, and `location.origin`. Scripts run for
 * real, against this window, as `injectJavaScript` would run them. A `sub`
 * frame's `window.top` is another window, as in an embedded iframe.
 */
function fakeDocument(url: string, post: (raw: string, url: string) => void, frame: 'top' | 'sub' = 'top') {
  const listeners = new Map<string, Listener[]>();
  const css = new Map<string, string>();
  const window: Record<string, unknown> = {
    ReactNativeWebView: { postMessage: (raw: string) => post(raw, url) },
    addEventListener: (type: string, fn: Listener) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    dispatchEvent: (e: { type: string; detail: unknown }) => {
      for (const fn of listeners.get(e.type) ?? []) fn(e);
      return true;
    },
  };
  const document = { documentElement: { style: { setProperty: (k: string, v: string) => css.set(k, v) }, setAttribute: () => {} } };
  class CustomEvent {
    detail: unknown;
    constructor(
      readonly type: string,
      init: { detail: unknown },
    ) {
      this.detail = init.detail;
    }
  }
  class MutationObserver {
    observe() {}
    disconnect() {}
  }
  window.top = frame === 'top' ? window : {};
  const location = { origin: new URL(url).origin };
  const run = (script: string) =>
    new Function('window', 'document', 'location', 'CustomEvent', 'MutationObserver', script)(window, document, location, CustomEvent, MutationObserver);
  return { url, window, css, run };
}

type FakeDocument = ReturnType<typeof fakeDocument>;

/**
 * A game page in that document, doing what `bootGame` does: it looks for the
 * host after every script the web view runs (the SDK polls), sends
 * `game.ready` once it is there, and records the game events it receives.
 */
function fakeGame(doc: FakeDocument, rect?: GameRect) {
  const received: GameEventMessage[] = [];
  let ready = false;
  (doc.window.addEventListener as (t: string, fn: Listener) => void)(MESSAGE_EVENT, (e) => {
    const event = parseGameEvent(e.detail);
    if (event) received.push(event);
  });
  const post = (msg: unknown) => (doc.window.ReactNativeWebView as { postMessage(raw: string): void }).postMessage(JSON.stringify(msg));
  const poll = () => {
    const host = doc.window.skkuverse as { capabilities: readonly string[] } | undefined;
    if (ready || !host?.capabilities.includes('game.ready')) return;
    ready = true;
    post({ method: 'game.ready', params: rect ? { rect } : {} });
  };
  return { received, post, poll, isReady: () => ready };
}

const VIEWPORT: Viewport = hostedViewport({ top: 59, bottom: 34, left: 0, right: 0 });

/**
 * The web view, wired to the host as `HostedPage` wires it: the before-load
 * script, `onLoadEnd`, `onMessage`, and the screen answering `game.ready`
 * with `game.init` as `GameScreen` does.
 */
function harness(options: { dropBeforeLoad: boolean; rect?: GameRect }) {
  const heard: GamePageMessage[] = [];
  const layouts: GameRect[] = [];
  let doc: FakeDocument;
  let game: ReturnType<typeof fakeGame>;
  const order: string[] = [];
  const inject = (script: string) => {
    doc.run(script);
    game?.poll();
  };
  const link = hostedLink({
    origin: ORIGIN,
    inject,
    bootstrap: () => hostedBootstrapScript(VIEWPORT, ORIGIN),
    onMessage: (m) => {
      order.push(m.type);
      heard.push(m);
      if (m.type === 'game:ready') link.send({ type: 'init', hi: 42, sound: true });
    },
    onLayout: (rect) => {
      order.push('layout');
      layouts.push(rect);
    },
  });
  const onMessage = (raw: string, url: string) => link.received({ data: raw, url });
  /** Load `url`: the before-load bootstrap, maybe on a document then replaced, the page, then onLoadEnd. */
  const load = (url = PAGE, frame: 'top' | 'sub' = 'top') => {
    const first = fakeDocument(url, onMessage, frame);
    first.run(hostedBootstrapScript(VIEWPORT, ORIGIN));
    doc = options.dropBeforeLoad ? fakeDocument(url, onMessage, frame) : first;
    game = fakeGame(doc, options.rect);
    game.poll();
    link.loadEnded();
  };
  return {
    link,
    load,
    heard,
    layouts,
    order,
    get doc() {
      return doc;
    },
    get game() {
      return game;
    },
  };
}

describe('the hosted handshake', () => {
  test('completes through onLoadEnd when the before-load injection landed on a replaced document', () => {
    const h = harness({ dropBeforeLoad: true });
    h.load();
    expect(h.game.isReady()).toBe(true);
    expect(h.heard).toStrictEqual([{ type: 'game:ready' }]);
    expect(h.game.received).toStrictEqual([{ event: 'game.init', data: { gameProtocol: GAME_PROTOCOL, hi: 42, sound: true } }]);
    expect(h.doc.css.get('--sv-inset-top')).toBe('59px');
  });

  test('says ready once when the before-load injection held: the second bootstrap returns at once', () => {
    const h = harness({ dropBeforeLoad: false });
    h.load();
    expect(h.heard).toStrictEqual([{ type: 'game:ready' }]);
    expect(h.game.received).toHaveLength(1);
  });

  test('places the rectangle game.ready carries before the session hears ready', () => {
    const h = harness({ dropBeforeLoad: true, rect: RECT });
    h.load();
    expect(h.order).toStrictEqual(['layout', 'game:ready']);
    expect(h.layouts).toStrictEqual([RECT]);
    const moved = { ...RECT, y: 280 };
    h.game.post({ method: 'game.layout', params: { rect: moved } });
    expect(h.layouts).toStrictEqual([RECT, moved]);
  });

  test('every host event reaches the page as the game event', () => {
    const h = harness({ dropBeforeLoad: true });
    h.load();
    for (const command of [{ type: 'pause' }, { type: 'resume' }, { type: 'sound', on: false }, { type: 'revive' }, { type: 'reset' }] as const) {
      h.link.send(command);
    }
    expect(h.game.received.map((e) => e.event)).toStrictEqual(['game.init', 'game.pause', 'game.resume', 'game.sound', 'game.revive', 'game.reset']);
  });

  test('a page reports through the session machine, and a legacy message reaches nothing', () => {
    const h = harness({ dropBeforeLoad: true });
    h.load();
    h.game.post({ type: 'game:start' });
    h.game.post({ type: 'game:over', score: 999, ticks: 1, hit: null, revives: 0, revivesLeft: 0 });
    expect(h.heard).toStrictEqual([{ type: 'game:ready' }]);
    h.game.post({ method: 'game.start', params: {} });
    expect(h.heard).toStrictEqual([{ type: 'game:ready' }, { type: 'game:start' }]);
  });

  test('a message from another origin is dropped, and nothing is said back', () => {
    const h = harness({ dropBeforeLoad: true });
    h.load();
    const other = fakeDocument('https://example.com/', (raw, url) => h.link.received({ data: raw, url }));
    const otherGame = fakeGame(other);
    otherGame.post({ method: 'game.ready', params: {} });
    otherGame.post({ id: 'r1', method: 'game.submit', params: {} });
    expect(h.heard).toStrictEqual([{ type: 'game:ready' }]);
    expect(h.game.received).toHaveLength(1);
  });

  test('delivery is gated on the game origin inside the page', () => {
    const h = harness({ dropBeforeLoad: true });
    h.load();
    // The web view somehow holds another site's document (the host refuses navigation; this is the second gate),
    // and that page plants its own `window.skkuverse` to hear what the host says.
    h.load('https://example.com/');
    const overheard: string[] = [];
    h.doc.window.skkuverse = { capabilities: [], receive: (json: string) => overheard.push(json) };
    h.link.send({ type: 'revive' });
    expect(overheard).toStrictEqual([]);
    expect(h.game.received).toStrictEqual([]);
  });

  test('a request from the page is answered unsupported, to the game origin', () => {
    const h = harness({ dropBeforeLoad: true });
    h.load();
    const replies: unknown[] = [];
    (h.doc.window.addEventListener as (t: string, fn: Listener) => void)(MESSAGE_EVENT, (e) => replies.push(e.detail));
    h.game.post({ id: 'r1', method: 'game.submit', params: {} });
    expect(replies).toStrictEqual([{ id: 'r1', ok: false, error: { code: 'unsupported', message: 'Unknown method: game.submit' } }]);
  });

  test('a viewport change resets the page CSS variables', () => {
    const h = harness({ dropBeforeLoad: true });
    h.load();
    h.link.viewportChanged(hostedViewport({ top: 0, bottom: 21, left: 59, right: 59 }));
    expect(h.doc.css.get('--sv-inset-top')).toBe('0px');
    expect(h.doc.css.get('--sv-inset-left')).toBe('59px');
  });

  test('navigation away is refused', () => {
    const h = harness({ dropBeforeLoad: true });
    expect(h.link.allows('https://example.com')).toBe(false);
    expect(h.link.allows(PAGE)).toBe(true);
  });
});

describe('the bootstrap is gated on the game origin and the top frame', () => {
  const run = (url: string, frame: 'top' | 'sub' = 'top') => {
    const doc = fakeDocument(url, () => {}, frame);
    doc.run(hostedBootstrapScript(VIEWPORT, ORIGIN));
    return doc;
  };

  test("the game origin's top frame gets the host, with the game grants and the viewport", () => {
    const doc = run(PAGE);
    expect((doc.window.skkuverse as { capabilities: readonly string[] }).capabilities).toStrictEqual(GAME_GRANTS);
    expect(doc.css.get('--sv-inset-top')).toBe('59px');
  });

  it.each([
    ['another site', 'https://example.com/'],
    ['the same host over http', 'http://apple-game.game.skkuverse.com/'],
    ['another game', 'https://wave-run.game.skkuverse.com/'],
  ])('a document on %s gets no host and no CSS variables', (_name, url) => {
    const doc = run(url);
    expect(doc.window.skkuverse).toBeUndefined();
    expect(doc.css.size).toBe(0);
  });

  test('a subframe, even on the game origin, gets no host', () => {
    expect(run(PAGE, 'sub').window.skkuverse).toBeUndefined();
  });

  it.each([true, false])('through the web view (before-load dropped: %s), neither injection installs it off the game', (dropBeforeLoad) => {
    const h = harness({ dropBeforeLoad });
    h.load('https://example.com/');
    expect(h.doc.window.skkuverse).toBeUndefined();
    expect(h.game.isReady()).toBe(false);
    h.load(PAGE, 'sub');
    expect(h.doc.window.skkuverse).toBeUndefined();
    expect(h.heard).toStrictEqual([]);
  });
});

describe('the retry state', () => {
  test('a load error shows it; a retry hides it and mounts a fresh web view', () => {
    const failed = pageLoadAfter(initialPageLoad, { type: 'error' });
    expect(failed).toStrictEqual({ failed: true, attempt: 0 });
    expect(pageLoadAfter(failed, { type: 'retry' })).toStrictEqual({ failed: false, attempt: 1 });
  });

  it.each([
    [404, true],
    [500, true],
    [503, true],
    [304, false],
    [200, false],
  ])('an HTTP %d on the page → failed %s', (status, failed) => {
    expect(pageLoadAfter(initialPageLoad, { type: 'httpError', status }).failed).toBe(failed);
  });
});

describe('a hosted run in the session machine', () => {
  test('the session states of a run, and the result keeps the page\'s validator', () => {
    const over = { score: 120, ticks: 3600, hit: 'timeout', revives: 0, revivesLeft: 0, validator: 'apple-game@1' };
    const messages = [
      { method: 'game.ready', params: {} },
      { method: 'game.start', params: {} },
      { method: 'game.phase', params: { phase: 'running' } },
      { method: 'game.over', params: over },
    ].map((msg) => {
      const r = read(msg);
      if (r.kind !== 'page') throw new Error(`not a page report: ${JSON.stringify(msg)}`);
      return r.message;
    });

    let run = initialPageRun;
    let session = initialSession();
    for (const m of messages) {
      if (m.type === 'game:over') expect(acceptsOver(run)).toBe(true);
      run = pageRunAfter(run, m);
      session = sessionReducer(session, { type: 'page', message: m });
    }

    expect(session.phase).toBe('crashed');
    expect(session.over).toStrictEqual({ score: 120, ticks: 3600, hit: 'timeout', revives: 0, revivesLeft: 0, validator: 'apple-game@1' });
    expect(submitValidator(session.over!)).toBe('apple-game@1');
  });
});
