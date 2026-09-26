import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initialSetup, setupReducer, answersOf, canAdvance } from './domain.ts';

const start = (steps: ('campus' | 'nickname')[], nickname: string | null = null) => initialSetup(steps, { nickname });

describe('setupFlow', () => {
  test('walks the given steps in order and finishes after the last', () => {
    let s = start(['campus', 'nickname']);
    assert.equal(s.current, 'campus');
    s = setupReducer(s, { type: 'SET_CAMPUS', campus: 'nsc' });
    s = setupReducer(s, { type: 'NEXT' });
    assert.equal(s.current, 'nickname');
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: ' 파도왕 ' });
    s = setupReducer(s, { type: 'NEXT' });
    assert.equal(s.current, 'done');
    assert.deepEqual(answersOf(s), { campus: 'nsc', nickname: '파도왕' });
  });

  test('the campus is required', () => {
    let s = start(['campus']);
    assert.equal(canAdvance(s), false);
    s = setupReducer(s, { type: 'NEXT' });
    assert.equal(s.current, 'campus');
    s = setupReducer(s, { type: 'SET_CAMPUS', campus: 'hssc' });
    s = setupReducer(s, { type: 'NEXT' });
    assert.equal(s.current, 'done');
    assert.deepEqual(answersOf(s), { campus: 'hssc' });
  });

  test('the nickname advances only when valid', () => {
    let s = start(['nickname'], 'ab');
    assert.equal(s.nickname, 'ab', 'prefilled');
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: '파' });
    assert.equal(canAdvance(s), false);
    s = setupReducer(s, { type: 'NEXT' });
    assert.equal(s.current, 'nickname');
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: '파도' });
    s = setupReducer(s, { type: 'NEXT' });
    assert.equal(s.current, 'done');
    assert.deepEqual(answersOf(s), { nickname: '파도' });
  });

  test('a device suggestion preselects the campus, still asked', () => {
    let s = initialSetup(['campus'], { nickname: null, prefill: { campus: 'nsc' } });
    assert.equal(s.current, 'campus');
    assert.equal(canAdvance(s), true);
    s = setupReducer(s, { type: 'NEXT' });
    assert.deepEqual(answersOf(s), { campus: 'nsc' });
  });

  test('the nickname is saved composed (NFC)', () => {
    let s = start(['nickname']);
    s = setupReducer(s, { type: 'SET_NICKNAME', nickname: '파도'.normalize('NFD') });
    s = setupReducer(s, { type: 'NEXT' });
    assert.equal(answersOf(s).nickname, '파도');
  });

  test('PREV never goes before the first step; nothing to ask is done at once', () => {
    let s = start(['campus', 'nickname']);
    s = setupReducer(s, { type: 'PREV' });
    assert.equal(s.current, 'campus');
    s = setupReducer(s, { type: 'SET_CAMPUS', campus: 'hssc' });
    s = setupReducer(s, { type: 'NEXT' });
    s = setupReducer(s, { type: 'PREV' });
    assert.equal(s.current, 'campus');
    assert.equal(start([]).current, 'done');
    assert.deepEqual(answersOf(start([])), {});
  });
});
