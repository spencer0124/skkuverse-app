/**
 * Leaderboards, game-agnostic: one entry per player per game
 * (`leaderboards/{gameId}/scores/{uid}`, their best), shown as a top-N list
 * with the player's own line placed into it.
 *
 * Pure: type-only imports, so it loads under `node --test` as is.
 */
import type { Campus } from '@skkuverse/shared';

/** What a board shows of an entry. */
export interface BoardEntry {
  uid: string;
  nickname: string;
  emailPrefix: string;
  campus: Campus;
  score: number;
}

/**
 * Which way a game's score counts: `desc` when more is better (a distance),
 * `asc` when less is (a time). Every comparison of two scores goes through
 * `isBetter`, and the board is read in this order.
 */
export type ScoreOrder = 'asc' | 'desc';

/** `a` beats `b` strictly; a tie is not better. */
export function isBetter(order: ScoreOrder, a: number, b: number): boolean {
  return order === 'asc' ? a < b : a > b;
}

/** Tied scores share a rank and the next rank skips: 1, 2, 2, 4. `scores` is in board order. */
export function rankWithTies(scores: readonly number[]): number[] {
  const out: number[] = [];
  scores.forEach((s, i) => out.push(i > 0 && scores[i - 1] === s ? out[i - 1]! : i + 1));
  return out;
}

/** The same rank from a count: entries strictly above, plus one. */
export function rankFromCount(countAbove: number): number {
  return countAbove + 1;
}

/**
 * The player's own line. `entry` is their best already on the board; `ghost`
 * is a score that is not on it (signed out, or no nickname yet) shown where
 * it would rank. Either way the rank comes from the server count.
 */
export type MyLine =
  | { kind: 'entry'; entry: BoardEntry; rank: number }
  | { kind: 'ghost'; uid: string; score: number; rank: number };

const uidOf = (me: MyLine) => (me.kind === 'entry' ? me.entry.uid : me.uid);

export type BoardLine =
  | { kind: 'entry'; key: string; rank: number; entry: BoardEntry; mine: boolean }
  | { kind: 'ghost'; key: string; rank: number; score: number }
  /** A place nobody holds yet, drawn blank so a short board keeps its shape. */
  | { kind: 'empty'; key: string; rank: number }
  | { kind: 'gap'; key: 'gap' };

/**
 * The lines to draw. The player's line is placed by its score among the top
 * (after the scores it ties, which got there first) and the ranks inside the
 * list are counted from what it shows, so a ghost pushes the lines below it
 * down a rank. A line that falls outside the list follows a gap at the
 * server's rank; the gap is left out when nothing is hidden.
 *
 * The player's line replaces any copy of them in `top` (a stale best, or the
 * entry a ghost is about to raise) and keeps their uid as its key wherever it
 * sits, so moving up animates as a move, not a new row.
 */
export function boardLines(input: {
  /** In board order: best first. */
  top: readonly BoardEntry[];
  order: ScoreOrder;
  limit: number;
  me: MyLine | null;
  /** Pad a short board with empty places up to `limit`. */
  fill?: boolean;
}): BoardLine[] {
  const limit = Math.max(0, input.limit);
  const { me } = input;
  const myUid = me ? uidOf(me) : null;
  const others = input.top.filter((e) => e.uid !== myUid);
  const myScore = me ? (me.kind === 'entry' ? me.entry.score : me.score) : 0;
  const at = me ? others.findIndex((e) => isBetter(input.order, myScore, e.score)) : -1;
  const pos = !me ? -1 : at === -1 ? others.length : at;

  type Slot = { score: number; line: (rank: number) => BoardLine };
  const slots: Slot[] = others.map((entry) => ({
    score: entry.score,
    line: (rank) => ({ kind: 'entry', key: entry.uid, rank, entry, mine: false }),
  }));
  if (me) {
    slots.splice(pos, 0, {
      score: myScore,
      line: (rank) =>
        me.kind === 'entry'
          ? { kind: 'entry', key: me.entry.uid, rank, entry: me.entry, mine: true }
          : { kind: 'ghost', key: me.uid, rank, score: me.score },
    });
  }

  const shown = slots.slice(0, limit);
  const ranks = rankWithTies(shown.map((x) => x.score));
  const lines = shown.map((x, i) => x.line(ranks[i]!));
  if (input.fill) {
    for (let r = lines.length + 1; r <= limit; r++) lines.push({ kind: 'empty', key: `empty-${r}`, rank: r });
  }
  if (!me || pos < limit) return lines;

  // Below the list every shown line scores at least as well, so a line ranked
  // right after the last shown one hides nothing.
  const mine = slots[pos]!.line(me.rank);
  return lines.length > 0 && me.rank > lines.length + 1 ? [...lines, { kind: 'gap', key: 'gap' }, mine] : [...lines, mine];
}
