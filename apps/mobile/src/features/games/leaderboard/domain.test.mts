import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { boardLines, isBetter, rankFromCount, rankWithTies, type BoardEntry } from './domain.ts';

const e = (uid: string, score: number): BoardEntry => ({
  uid,
  nickname: uid,
  emailPrefix: uid.slice(0, 3),
  campus: 'hssc',
  score,
});
const top = [e('a', 500), e('b', 400), e('c', 400), e('d', 300), e('f', 200)];

describe('rankWithTies', () => {
  test('tied scores share a rank, the next rank skips (1, 2, 2, 4)', () => {
    assert.deepEqual(rankWithTies([500, 400, 400, 300, 200]), [1, 2, 2, 4, 5]);
    assert.deepEqual(rankWithTies([]), []);
  });
  test('matches the count the result sheet uses: entries strictly above + 1', () => {
    assert.equal(rankFromCount(0), 1);
    assert.equal(rankFromCount(41), 42);
  });
});

describe('boardLines', () => {
  test('the top as it is, with ranks', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: null });
    assert.deepEqual(lines.map((l) => [l.kind, l.key, l.kind === 'gap' ? null : l.rank]), [
      ['entry', 'a', 1],
      ['entry', 'b', 2],
      ['entry', 'c', 2],
      ['entry', 'd', 4],
      ['entry', 'f', 5],
    ]);
  });

  test('my own entry inside the top is marked mine', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'entry', entry: e('c', 400), rank: 2 } });
    assert.deepEqual(
      lines.filter((l) => l.kind === 'entry' && l.mine).map((l) => l.key),
      ['c'],
    );
  });

  test('my entry below the top comes after a gap, at its own rank', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'entry', entry: e('z', 50), rank: 17 } });
    assert.deepEqual(lines.slice(-2).map((l) => [l.kind, l.key]), [
      ['gap', 'gap'],
      ['entry', 'z'],
    ]);
    const mine = lines.at(-1)!;
    assert.equal(mine.kind === 'entry' && mine.mine && mine.rank, 17);
  });

  test('a ghost is placed where it would rank; the lines below it move down a rank; the list keeps its length', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'ghost', uid: 'me', score: 450, rank: 2 } });
    assert.deepEqual(lines.map((l) => [l.kind, l.key, l.kind === 'gap' ? null : l.rank]), [
      ['entry', 'a', 1],
      ['ghost', 'me', 2],
      ['entry', 'b', 3],
      ['entry', 'c', 3],
      ['entry', 'd', 5],
    ]);
  });

  test('a ghost that ties goes after the scores it ties, at the shared rank', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'ghost', uid: 'me', score: 400, rank: 2 } });
    assert.deepEqual(lines.map((l) => [l.key, l.kind === 'gap' ? null : l.rank]), [
      ['a', 1],
      ['b', 2],
      ['c', 2],
      ['me', 2],
      ['d', 5],
    ]);
  });

  test('a ghost below the top comes after a gap, at the server rank', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'ghost', uid: 'me', score: 10, rank: 30 } });
    assert.deepEqual(lines.slice(-2).map((l) => [l.kind, l.kind === 'gap' ? null : l.rank]), [
      ['gap', null],
      ['ghost', 30],
    ]);
  });

  test('no gap after a tied tail when nothing is hidden (5 shown, I am 6th)', () => {
    const tail = [e('a', 500), e('b', 400), e('c', 300), e('d', 300), e('f', 300)];
    const lines = boardLines({ order: 'desc', top: tail, limit: 5, me: { kind: 'ghost', uid: 'me', score: 100, rank: 6 } });
    assert.deepEqual(lines.map((l) => l.kind), ['entry', 'entry', 'entry', 'entry', 'entry', 'ghost']);
  });

  test('no gap when nothing is hidden (tying the last line)', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'ghost', uid: 'me', score: 200, rank: 5 } });
    assert.deepEqual(lines.map((l) => l.kind), ['entry', 'entry', 'entry', 'entry', 'entry', 'ghost']);
  });

  test("a ghost for a player already on the board replaces their line (one key, no duplicate)", () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'ghost', uid: 'c', score: 450, rank: 2 } });
    assert.deepEqual(lines.map((l) => l.key), ['a', 'c', 'b', 'd', 'f']);
    assert.equal(new Set(lines.map((l) => l.key)).size, lines.length);
  });

  test('my fresh entry wins over a stale copy of it in the top (just submitted, top not refetched)', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'entry', entry: e('d', 480), rank: 2 } });
    assert.deepEqual(lines.map((l) => [l.key, l.kind === 'gap' ? null : l.rank]), [
      ['a', 1],
      ['d', 2],
      ['b', 3],
      ['c', 3],
      ['f', 5],
    ]);
  });

  test('a new entry not yet in the fetched top still lands in its place', () => {
    const lines = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'entry', entry: e('z', 450), rank: 2 } });
    assert.deepEqual(lines.map((l) => l.key), ['a', 'z', 'b', 'c', 'd']);
    assert.equal(lines.some((l) => l.kind === 'gap'), false);
  });

  test('a zero or negative limit shows only my line, if any', () => {
    assert.deepEqual(boardLines({ order: 'desc', top, limit: 0, me: null }), []);
    assert.deepEqual(
      boardLines({ order: 'desc', top, limit: -1, me: { kind: 'ghost', uid: 'me', score: 10, rank: 30 } }).map((l) => l.kind),
      ['ghost'],
    );
  });

  test('my entry keeps one key wherever it sits, so a move up animates instead of re-entering', () => {
    const before = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'entry', entry: e('z', 50), rank: 17 } });
    const after = boardLines({
      order: 'desc',
      top: [e('a', 500), e('z', 450), e('b', 400), e('c', 400), e('d', 300)],
      limit: 5,
      me: { kind: 'entry', entry: e('z', 450), rank: 2 },
    });
    assert.equal(before.filter((l) => l.key === 'z').length, 1);
    assert.equal(after.filter((l) => l.key === 'z').length, 1);
    assert.equal(after.some((l) => l.kind === 'gap'), false);
  });

  test('a short board (fewer than the limit) takes the ghost in its place', () => {
    const lines = boardLines({ order: 'desc', top: [e('a', 500)], limit: 5, me: { kind: 'ghost', uid: 'me', score: 10, rank: 2 } });
    assert.deepEqual(lines.map((l) => l.key), ['a', 'me']);
  });

  test('an empty board with no me is empty', () => {
    assert.deepEqual(boardLines({ order: 'desc', top: [], limit: 5, me: null }), []);
  });

  test('fill: a short board is padded with empty places up to the limit, numbered on', () => {
    const lines = boardLines({ order: 'desc', top: [e('a', 500)], limit: 5, me: { kind: 'ghost', uid: 'me', score: 10, rank: 2 }, fill: true });
    assert.deepEqual(lines.map((l) => [l.kind, l.key, l.kind === 'gap' ? null : l.rank]), [
      ['entry', 'a', 1],
      ['ghost', 'me', 2],
      ['empty', 'empty-3', 3],
      ['empty', 'empty-4', 4],
      ['empty', 'empty-5', 5],
    ]);
    assert.deepEqual(
      boardLines({ order: 'desc', top: [], limit: 3, me: null, fill: true }).map((l) => l.key),
      ['empty-1', 'empty-2', 'empty-3'],
    );
  });

  test('fill does nothing to a full board, and never pads past a gap', () => {
    const full = boardLines({ order: 'desc', top, limit: 5, me: { kind: 'ghost', uid: 'me', score: 10, rank: 30 }, fill: true });
    assert.equal(full.some((l) => l.kind === 'empty'), false);
  });
});

describe('a time board (asc: less is better)', () => {
  // Board order for a time: fastest first.
  const times = [e('a', 30_000), e('b', 41_000), e('c', 41_000), e('d', 52_000), e('f', 60_000)];

  test('isBetter reads the order, and a tie is never better', () => {
    assert.equal(isBetter('asc', 30_000, 41_000), true);
    assert.equal(isBetter('asc', 41_000, 30_000), false);
    assert.equal(isBetter('desc', 500, 400), true);
    assert.equal(isBetter('asc', 5, 5), false);
    assert.equal(isBetter('desc', 5, 5), false);
  });

  test('a faster ghost goes above the slower lines and pushes them down a rank', () => {
    const lines = boardLines({ order: 'asc', top: times, limit: 5, me: { kind: 'ghost', uid: 'me', score: 35_000, rank: 2 } });
    assert.deepEqual(lines.map((l) => [l.key, l.kind === 'gap' ? null : l.rank]), [
      ['a', 1],
      ['me', 2],
      ['b', 3],
      ['c', 3],
      ['d', 5],
    ]);
  });

  test('a tied time goes after the lines it ties, which got there first', () => {
    const lines = boardLines({ order: 'asc', top: times, limit: 5, me: { kind: 'ghost', uid: 'me', score: 41_000, rank: 2 } });
    assert.deepEqual(lines.map((l) => l.key), ['a', 'b', 'c', 'me', 'd']);
  });

  test('a slower line falls below the list after a gap', () => {
    const lines = boardLines({ order: 'asc', top: times, limit: 5, me: { kind: 'entry', entry: e('z', 90_000), rank: 12 } });
    assert.deepEqual(lines.map((l) => l.key), ['a', 'b', 'c', 'd', 'f', 'gap', 'z']);
  });
});
