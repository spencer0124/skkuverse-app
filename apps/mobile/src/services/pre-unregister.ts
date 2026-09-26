/**
 * Sign-in phase A (deactivate this device's doc under the signed-in uid),
 * started without blocking the Google sheet and settled before whatever it
 * must precede.
 *
 * Why not simply await it first: a Firestore write settles only on server
 * ack, so offline the sheet never opened and the button spun until the network
 * came back.
 *
 * Why not simply bound that await: pending writes are queued per uid. When
 * sign-in switches to another account, a write still queued under the old uid
 * is never sent, the doc stays active under a uid nobody holds, and the
 * re-register under the new uid is denied by the claim rule — for good. So the
 * write gets the whole time the student spends in the sheet, and then:
 *
 *  - `landed()` before the uid changes: waits for the server ack. Past its
 *    bound the doc may be stranded, so that is reported.
 *  - `issued()` before the re-register when the uid did not change: the write
 *    only has to be queued ahead of it, since one uid's queue is sent in
 *    order. Past its bound it is aborted instead — a write still waiting on
 *    App Check must never be issued behind the re-register — and the doc,
 *    still under the same uid, is simply re-activated.
 *
 * Both are memoized and abort on timeout. `abort()` drops a write not yet
 * issued (sign-in failed or was cancelled: the doc stays with the user it
 * still belongs to).
 *
 * No relative or native imports, so the node test runner can load it.
 */
export type PreUnregister = {
  landed: () => Promise<void>;
  issued: () => Promise<void>;
  abort: () => void;
};

export function startPreUnregister(opts: {
  run: (signal: AbortSignal, onIssued: () => void) => Promise<void>;
  timeoutMs: number;
  onLandTimeout: () => void;
}): PreUnregister {
  const controller = new AbortController();
  let markIssued: () => void = () => {};
  const issuedSignal = new Promise<void>((resolve) => {
    markIssued = resolve;
  });
  // Failures are the run's to log; phase A never fails sign-in. A run that
  // ends without issuing (skipped, failed early) also releases `issued()`.
  const done = opts.run(controller.signal, markIssued).then(
    () => undefined,
    () => undefined,
  );
  done.then(markIssued);
  // Once aborted the write can no longer be issued, so nothing is left for
  // `issued()` to wait on — after a `landed()` timeout, for one.
  const stop = () => {
    controller.abort();
    markIssued();
  };

  const within = async (work: Promise<void>): Promise<boolean> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), opts.timeoutMs);
    });
    const inTime = await Promise.race([work.then(() => true), bound]);
    clearTimeout(timer);
    if (!inTime) stop();
    return inTime;
  };

  let landed: Promise<void> | null = null;
  let issued: Promise<void> | null = null;
  return {
    landed: () =>
      (landed ??= within(done).then((inTime) => {
        if (!inTime) opts.onLandTimeout();
      })),
    issued: () => (issued ??= within(issuedSignal).then(() => undefined)),
    abort: stop,
  };
}

/** Phase A skipped: nothing to settle. */
export const NO_PRE_UNREGISTER: PreUnregister = {
  landed: async () => {},
  issued: async () => {},
  abort: () => {},
};
