import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startPreUnregister } from './pre-unregister.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mirrors unregisterDevice: prime App Check for `primeMs`, then issue the write
// unless aborted, and the write lands after `ackMs` (never, offline).
function fakeUnregister(primeMs: number, ackMs: number | null) {
  const log: string[] = [];
  const run = async (signal: AbortSignal, onIssued: () => void) => {
    await sleep(primeMs);
    if (signal.aborted) {
      log.push('skipped');
      return;
    }
    log.push('issued');
    onIssued();
    if (ackMs === null) return new Promise<void>(() => {});
    await sleep(ackMs);
    log.push('acked');
  };
  return { run, log };
}

const noTimeout = () => assert.fail('unexpected land timeout');

describe('startPreUnregister', () => {
  test('does not block: returns before the write is issued', () => {
    const { run, log } = fakeUnregister(10, 10);
    startPreUnregister({ run, timeoutMs: 100, onLandTimeout: noTimeout });
    assert.deepEqual(log, []);
  });

  describe('landed (before the uid changes)', () => {
    test('a write that landed while the sheet was open settles at once', async () => {
      const { run, log } = fakeUnregister(5, 5);
      const pre = startPreUnregister({ run, timeoutMs: 100, onLandTimeout: noTimeout });
      await sleep(30); // the student choosing an account
      const t0 = Date.now();
      await pre.landed();
      assert.ok(Date.now() - t0 < 10);
      assert.deepEqual(log, ['issued', 'acked']);
    });

    test('waits for the ack of a write still in flight', async () => {
      const { run, log } = fakeUnregister(5, 30);
      const pre = startPreUnregister({ run, timeoutMs: 200, onLandTimeout: noTimeout });
      await pre.landed();
      assert.deepEqual(log, ['issued', 'acked']);
    });

    // The stranded-doc case: counted, and it must not hold sign-in up.
    test('past the bound: reports once and resolves', async () => {
      let timeouts = 0;
      const { run } = fakeUnregister(5, null);
      const pre = startPreUnregister({ run, timeoutMs: 20, onLandTimeout: () => timeouts++ });
      await pre.landed();
      const t0 = Date.now();
      await pre.landed(); // memoized: no second bound
      assert.ok(Date.now() - t0 < 10);
      assert.equal(timeouts, 1);
    });
  });

  describe('issued (before the re-register, uid unchanged)', () => {
    // Same queue, sent in order: no need to wait for the server.
    test('resolves once issued, without waiting for the ack', async () => {
      const { run, log } = fakeUnregister(5, null);
      const pre = startPreUnregister({ run, timeoutMs: 200, onLandTimeout: noTimeout });
      await pre.issued();
      assert.deepEqual(log, ['issued']);
    });

    // A late `active: false` must never follow the re-register.
    test('past the bound while App Check is priming: aborted, never issued, not reported', async () => {
      const { run, log } = fakeUnregister(60, 5);
      const pre = startPreUnregister({ run, timeoutMs: 20, onLandTimeout: noTimeout });
      await pre.issued();
      await sleep(80);
      assert.deepEqual(log, ['skipped']);
    });

    test('a run that fails before issuing releases it at once', async () => {
      const pre = startPreUnregister({
        run: async () => {
          throw new Error('app-check');
        },
        timeoutMs: 1_000,
        onLandTimeout: noTimeout,
      });
      const t0 = Date.now();
      await pre.issued();
      assert.ok(Date.now() - t0 < 50);
    });
  });

  // Cancelled sheet while priming: the doc stays active, as it should.
  test('abort before the write is issued skips it', async () => {
    const { run, log } = fakeUnregister(20, 5);
    const pre = startPreUnregister({ run, timeoutMs: 100, onLandTimeout: noTimeout });
    pre.abort();
    await sleep(40);
    assert.deepEqual(log, ['skipped']);
  });

  test('a failing write never rejects', async () => {
    const pre = startPreUnregister({
      run: async () => {
        throw new Error('permission-denied');
      },
      timeoutMs: 100,
      onLandTimeout: noTimeout,
    });
    await pre.landed();
    await pre.issued();
  });
});

// Fallback: the uid already changed; waiting again for a write that can no
// longer be issued would only extend the spinner.
test('after a landed() timeout, issued() does not wait a second bound', async () => {
  const { run, log } = fakeUnregister(200, 5); // App Check priming well past the bound
  const pre = startPreUnregister({ run, timeoutMs: 20, onLandTimeout: () => {} });
  await pre.landed();
  const t0 = Date.now();
  await pre.issued();
  assert.ok(Date.now() - t0 < 10);
  await sleep(220);
  assert.deepEqual(log, ['skipped']);
});
