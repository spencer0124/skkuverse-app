import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGameMessage, parseHostMessage, hostScript } from './protocol.ts';

describe('parseGameMessage (web → app)', () => {
  test('accepts every well-formed message', () => {
    assert.deepEqual(parseGameMessage('{"type":"game:ready"}'), { type: 'game:ready' });
    assert.deepEqual(parseGameMessage('{"type":"game:start"}'), { type: 'game:start' });
    assert.deepEqual(parseGameMessage('{"type":"game:phase","phase":"paused"}'), {
      type: 'game:phase',
      phase: 'paused',
    });
    assert.deepEqual(parseGameMessage('{"type":"game:haptic","style":"heavy"}'), {
      type: 'game:haptic',
      style: 'heavy',
    });
    assert.deepEqual(parseGameMessage('{"type":"game:haptic","style":"error"}'), {
      type: 'game:haptic',
      style: 'error',
    });
    assert.deepEqual(
      parseGameMessage('{"type":"game:over","score":120,"ticks":3000,"hit":"bus","revives":1,"revivesLeft":1}'),
      { type: 'game:over', score: 120, ticks: 3000, hit: 'bus', revives: 1, revivesLeft: 1 },
    );
  });

  test('rejects malformed JSON, unknown types and host messages', () => {
    assert.equal(parseGameMessage('not json'), null);
    assert.equal(parseGameMessage('null'), null);
    assert.equal(parseGameMessage('{"type":"game:explode"}'), null);
    assert.equal(parseGameMessage('{"type":"host:revive"}'), null);
    assert.equal(parseGameMessage('{"type":"web:haptic","style":"light"}'), null);
  });

  test('rejects payloads a handler would act on wrongly', () => {
    assert.equal(parseGameMessage('{"type":"game:phase","phase":"flying"}'), null);
    assert.equal(parseGameMessage('{"type":"game:haptic","style":"loud"}'), null);
    // A score must be a non-negative integer: it is what gets submitted.
    assert.equal(parseGameMessage('{"type":"game:over","score":1.5,"ticks":1,"hit":null,"revives":0,"revivesLeft":2}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":-1,"ticks":1,"hit":null,"revives":0,"revivesLeft":2}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":"9","ticks":1,"hit":null,"revives":0,"revivesLeft":2}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":1,"ticks":1,"hit":null}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":1,"ticks":1,"hit":7,"revives":0,"revivesLeft":2}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":1,"ticks":1,"revives":0,"revivesLeft":2}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":1,"ticks":1,"hit":null,"revives":0}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":1e300,"ticks":1,"hit":null,"revives":0,"revivesLeft":2}'), null);
    assert.equal(parseGameMessage('{"type":"game:over","score":9007199254740993,"ticks":1,"hit":null,"revives":0,"revivesLeft":2}'), null);
    const longHit = 'x'.repeat(33);
    assert.equal(parseGameMessage(`{"type":"game:over","score":1,"ticks":1,"hit":"${longHit}","revives":0,"revivesLeft":2}`), null);
  });

  test('accepts a null hit and drops stray fields and shapes', () => {
    assert.deepEqual(
      parseGameMessage('{"type":"game:over","score":0,"ticks":0,"hit":null,"revives":0,"revivesLeft":2,"uid":"x"}'),
      { type: 'game:over', score: 0, ticks: 0, hit: null, revives: 0, revivesLeft: 2 },
    );
    assert.equal(parseGameMessage('[{"type":"game:ready"}]'), null);
    assert.equal(parseGameMessage('{"__proto__":{"type":"game:ready"}}'), null);
  });

  test('carries a well-formed stats map, rebuilt', () => {
    assert.deepEqual(
      parseGameMessage(
        '{"type":"game:over","score":61234,"ticks":238,"hit":null,"revives":0,"revivesLeft":0,"stats":{"kpm":233,"accuracy":97.5}}',
      ),
      { type: 'game:over', score: 61234, ticks: 238, hit: null, revives: 0, revivesLeft: 0, stats: { kpm: 233, accuracy: 97.5 } },
    );
  });

  test('drops malformed stats but keeps the result', () => {
    const base = '"type":"game:over","score":5,"ticks":1,"hit":null,"revives":0,"revivesLeft":0';
    const plain = { type: 'game:over', score: 5, ticks: 1, hit: null, revives: 0, revivesLeft: 0 };
    const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, i]));
    for (const stats of ['[1,2]', '{}', '{"kpm":"233"}', '{"kpm":null}', '{"bad key":1}', '{"__proto__":1}', JSON.stringify(nine), '"x"']) {
      assert.deepEqual(parseGameMessage(`{${base},"stats":${stats}}`), plain, stats);
    }
    // 1e999 parses to Infinity.
    assert.deepEqual(parseGameMessage(`{${base},"stats":{"kpm":1e999}}`), plain);
  });

  test('keeps only the declared fields', () => {
    assert.deepEqual(parseGameMessage('{"type":"game:ready","extra":1}'), { type: 'game:ready' });
  });
});

describe('parseHostMessage (app → web)', () => {
  test('accepts every well-formed message', () => {
    assert.deepEqual(parseHostMessage({ type: 'host:init', hi: 42 }), { type: 'host:init', hi: 42 });
    for (const type of ['host:revive', 'host:restart', 'host:reset', 'host:pause', 'host:resume'] as const) {
      assert.deepEqual(parseHostMessage({ type }), { type });
    }
    assert.deepEqual(parseHostMessage({ type: 'host:sound', on: false }), { type: 'host:sound', on: false });
  });

  test('rejects anything else', () => {
    assert.equal(parseHostMessage(null), null);
    assert.equal(parseHostMessage('host:revive'), null);
    assert.equal(parseHostMessage({ type: 'host:init' }), null);
    assert.equal(parseHostMessage({ type: 'host:init', hi: -3 }), null);
    assert.equal(parseHostMessage({ type: 'host:init', hi: 1.5 }), null);
    assert.equal(parseHostMessage({ type: 'host:sound' }), null);
    assert.equal(parseHostMessage({ type: 'host:sound', on: 'false' }), null);
    assert.equal(parseHostMessage({ type: 'game:ready' }), null);
  });
});

describe('hostScript', () => {
  test('calls the page receiver with the message as a JSON literal', () => {
    const js = hostScript({ type: 'host:init', hi: 7 });
    assert.equal(js, 'window.__host&&window.__host({"type":"host:init","hi":7});true;');
  });
});
