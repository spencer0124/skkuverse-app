/**
 * The fastest run the leaderboard believes: the whole route typed at
 * `MIN_MS_PER_KEY` a key. 40 ms is 1,500 keys a minute — the very top of
 * typing on a physical keyboard, and far beyond a phone's — so no honest run
 * comes near it, and a time under it can only be made up.
 *
 * `subwayTypingMinMs` in apps/mobile/firestore.rules is this number; the test
 * pins it, and so do the rules tests. Change the route and both must move.
 */
import { ROUTE } from './data/route';
import { keyCount } from './lib/stats';

export const MIN_MS_PER_KEY = 40;

/** Keys to type the whole route, 두벌식. */
export const TOTAL_KEYS = keyCount(ROUTE.map((s) => s.name));

export const MIN_RUN_MS = TOTAL_KEYS * MIN_MS_PER_KEY;
