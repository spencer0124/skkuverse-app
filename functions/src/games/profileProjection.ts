/**
 * The part of a player's profile (users/{uid}.profile) that their leaderboard
 * entries carry a copy of. Firestore rules make an entry equal to the profile
 * when it is written; onUserProfileWrite keeps the copies equal afterwards.
 */
export interface EntryProjection {
  nickname: string;
  campus: 'hssc' | 'nsc';
}

const CAMPUSES: readonly string[] = ['hssc', 'nsc'];

/** The projection of a users/{uid} document, or null when there is nothing a board could show. */
export function entryProjection(userDoc: Record<string, unknown> | undefined): EntryProjection | null {
  const p = userDoc?.profile;
  if (typeof p !== 'object' || p === null) return null;
  const { nickname, campus } = p as Record<string, unknown>;
  if (typeof nickname !== 'string' || typeof campus !== 'string' || !CAMPUSES.includes(campus)) return null;
  return { nickname, campus: campus as EntryProjection['campus'] };
}

/**
 * Whether existing entries may need rewriting. A projection appearing counts
 * too: a profile restored after a deletion could have entries under an old
 * name. For a genuinely new player it costs one empty query. A deleted
 * profile leaves the entries alone — account deletion removes them itself.
 */
export function projectionChanged(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  const b = entryProjection(after);
  if (!b) return false;
  const a = entryProjection(before);
  return !a || a.nickname !== b.nickname || a.campus !== b.campus;
}

/** Whether an entry's copy differs from the projection, so a retry writes nothing twice. */
export function needsRewrite(entry: Record<string, unknown>, p: EntryProjection): boolean {
  return entry.nickname !== p.nickname || entry.campus !== p.campus;
}

/**
 * A collection-group query on `scores` would match any collection of that
 * name; only leaderboards/{gameId}/scores/{uid} is ours to rewrite.
 */
export function isLeaderboardEntryPath(path: string): boolean {
  const parts = path.split('/');
  return parts.length === 4 && parts[0] === 'leaderboards' && parts[2] === 'scores';
}
