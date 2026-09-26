import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryProjection, isLeaderboardEntryPath, needsRewrite, projectionChanged } from '../src/games/profileProjection.ts';

const profile = { campus: 'hssc', nickname: '파도왕', updatedAt: { seconds: 1 } };

test('entryProjection: the two fields a leaderboard entry copies', () => {
  assert.deepEqual(entryProjection({ profile }), { nickname: '파도왕', campus: 'hssc' });
});

test('entryProjection: no profile, or no nickname yet → null (nothing to show)', () => {
  assert.equal(entryProjection(undefined), null);
  assert.equal(entryProjection({ locale: 'ko' }), null);
  assert.equal(entryProjection({ profile: { campus: 'hssc' } }), null);
});

test('entryProjection: malformed values are not propagated', () => {
  assert.equal(entryProjection({ profile: { campus: 'seoul', nickname: 'wave' } }), null);
  assert.equal(entryProjection({ profile: { campus: 'hssc', nickname: 7 } }), null);
});

test('projectionChanged: only nickname or campus count', () => {
  const before = { profile };
  assert.equal(projectionChanged(before, { profile: { ...profile, updatedAt: { seconds: 2 } } }), false);
  assert.equal(projectionChanged(before, { profile, locale: 'en' }), false);
  assert.equal(projectionChanged(before, { profile: { ...profile, nickname: '새이름' } }), true);
  assert.equal(projectionChanged(before, { profile: { ...profile, campus: 'nsc' } }), true);
});

test('projectionChanged: a projection appearing counts; losing it does not', () => {
  assert.equal(projectionChanged({ profile: { campus: 'hssc' } }, { profile }), true);
  assert.equal(projectionChanged(undefined, { profile }), true);
  assert.equal(projectionChanged({ profile }, undefined), false);
  assert.equal(projectionChanged({ profile }, { profile: { campus: 'hssc' } }), false);
});

test('needsRewrite: only an entry whose copy differs', () => {
  const p = { nickname: '파도왕', campus: 'hssc' as const };
  assert.equal(needsRewrite({ uid: 'u', score: 1, ...p }, p), false);
  assert.equal(needsRewrite({ uid: 'u', score: 1, ...p, nickname: 'old' }, p), true);
  assert.equal(needsRewrite({ uid: 'u', score: 1, ...p, campus: 'nsc' }, p), true);
});

test('isLeaderboardEntryPath: only leaderboards/{gameId}/scores/{uid}', () => {
  assert.equal(isLeaderboardEntryPath('leaderboards/wave-run/scores/u1'), true);
  assert.equal(isLeaderboardEntryPath('users/u/scores/x'), false);
  assert.equal(isLeaderboardEntryPath('leaderboards/wave-run/scores/u1/extra/y'), false);
  assert.equal(isLeaderboardEntryPath('a/leaderboards/wave-run/scores/u1'), false);
});
