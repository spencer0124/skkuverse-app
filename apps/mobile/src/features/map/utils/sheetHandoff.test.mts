/**
 * The campus sheet's hand-off to a modal.
 *
 * Two sheets on one screen must not stack: when a detail modal asks for the
 * screen the campus sheet goes down first, the modal rises once it has landed,
 * and the campus sheet returns to the detent it left when the modal goes. The
 * cases that would hurt are at the seams — a second modal asking while the
 * sheet is already down, a detent reported mid-close, a release with nothing
 * to restore.
 *
 * NOTE: apps/mobile runs `node --test`, a different runner from packages/shared's
 * vitest. `sheetHandoff.ts` imports nothing at all, so it loads under plain Node.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_HANDOFF, releaseHandoff, requestHandoff, sheetSettled } from './sheetHandoff.ts';

describe('requestHandoff', () => {
  it('closes an open sheet and holds the modal until it lands', () => {
    const { state, close, present } = requestHandoff({ ...IDLE_HANDOFF, index: 1 });
    assert.equal(close, true);
    assert.equal(present, false);
    assert.equal(state.restoreTo, 1);
    assert.equal(state.waiting, true);
  });

  it('presents at once when the sheet is already down', () => {
    // A second modal replacing the first: the sheet is closed for the first
    // one, so there is nothing to wait for and nothing to close.
    const down = { index: -1, restoreTo: 1, waiting: false };
    const { state, close, present } = requestHandoff(down);
    assert.equal(close, false);
    assert.equal(present, true);
    assert.equal(state.restoreTo, 1, 'the first modal’s restore point survives');
    assert.equal(state.waiting, false);
  });

  it('keeps the earliest restore point across nested requests', () => {
    const first = requestHandoff({ ...IDLE_HANDOFF, index: 2 }).state;
    const second = requestHandoff({ ...first, index: 0 });
    assert.equal(second.state.restoreTo, 2);
  });
});

describe('sheetSettled', () => {
  it('presents the waiting modal when the sheet reports closed', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, index: 1 }).state;
    const { state, present } = sheetSettled(waiting, -1);
    assert.equal(present, true);
    assert.equal(state.waiting, false);
    assert.equal(state.index, -1);
  });

  it('does not present on a detent that is not closed', () => {
    // gorhom reports every settled detent through the same callback.
    const waiting = requestHandoff({ ...IDLE_HANDOFF, index: 1 }).state;
    const { state, present } = sheetSettled(waiting, 0);
    assert.equal(present, false);
    assert.equal(state.waiting, true);
    assert.equal(state.index, 0);
  });

  it('tracks the detent and presents nothing when no modal is waiting', () => {
    const { state, present } = sheetSettled(IDLE_HANDOFF, 2);
    assert.equal(present, false);
    assert.equal(state.index, 2);
  });

  it('presents once, not on every later closed report', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, index: 1 }).state;
    const first = sheetSettled(waiting, -1);
    const again = sheetSettled(first.state, -1);
    assert.equal(again.present, false);
  });
});

describe('releaseHandoff', () => {
  it('returns the sheet to the detent it left', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, index: 1 }).state;
    const down = sheetSettled(waiting, -1).state;
    const { state, snapTo } = releaseHandoff(down);
    assert.equal(snapTo, 1);
    assert.equal(state.restoreTo, null);
    assert.equal(state.waiting, false);
  });

  it('snaps nowhere when no hand-off was in progress', () => {
    // A modal dismissed that never took the screen — the sheet is where the
    // user left it and must not jump.
    const { snapTo } = releaseHandoff({ ...IDLE_HANDOFF, index: 2 });
    assert.equal(snapTo, null);
  });

  it('drops a modal still waiting, so a cancelled hand-off cannot present later', () => {
    const waiting = requestHandoff({ ...IDLE_HANDOFF, index: 1 }).state;
    const { state } = releaseHandoff(waiting);
    assert.equal(state.waiting, false);
    assert.equal(sheetSettled(state, -1).present, false);
  });
});
