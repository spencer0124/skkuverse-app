/**
 * The channel between an in-app game page (a bundled WebView) and the native
 * screen that hosts it.
 *
 * This is deliberately not `@skkuverse/bridge`. That contract is vendored into
 * skkuverse-web and hash-checked by the umbrella, and it speaks for pages on
 * the open web. A bundled game is an app asset: it never leaves this repo, so
 * both ends import this file directly.
 *
 * The page owns gameplay; the host owns everything a run is worth — the high
 * score, revives, sign-in and the leaderboard. So the page reports what
 * happened and the host tells it what to do next, never the other way round.
 *
 * This file imports nothing, so it loads under plain Node for the tests and
 * inside the page bundle alike.
 */

/** `error` is a short, hard tap for a slip — not the notification pattern, which is too long to repeat. */
export type HapticStyle = 'light' | 'medium' | 'heavy' | 'error';
export type GamePhase = 'ready' | 'running' | 'paused' | 'crashed';

/** Page → host. */
export type GameMessage =
  | { type: 'game:ready' }
  | { type: 'game:start' }
  | { type: 'game:phase'; phase: GamePhase }
  | { type: 'game:haptic'; style: HapticStyle }
  | {
      type: 'game:over';
      score: number;
      ticks: number;
      /** What ended the run, in the game's own vocabulary. */
      hit: string | null;
      revives: number;
      /** How many more times the page would accept `host:revive` for this run. */
      revivesLeft: number;
      /**
       * Figures the result card shows beside the score, in the game's own
       * vocabulary (a typing game's speed and accuracy). Display only: nothing
       * here is submitted, so a malformed set is dropped, not the message.
       */
      stats?: GameStats;
    };

export type GameStats = Readonly<Record<string, number>>;

/** Host → page. */
export type HostMessage =
  | { type: 'host:init'; hi: number }
  | { type: 'host:revive' }
  | { type: 'host:restart' }
  /** Back to the title, with no run started: the player closed the result. */
  | { type: 'host:reset' }
  | { type: 'host:pause' }
  | { type: 'host:resume' }
  /** The player's sound setting, sent after `host:init` and on every change. */
  | { type: 'host:sound'; on: boolean };

const PHASES: readonly GamePhase[] = ['ready', 'running', 'paused', 'crashed'];
const HAPTICS: readonly HapticStyle[] = ['light', 'medium', 'heavy', 'error'];

/** A non-negative integer that survives JSON exactly — a score is submitted as is. */
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const HIT_MAX_LENGTH = 32;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const STATS_MAX_KEYS = 8;
const STAT_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,23}$/;

/** A small map of finite numbers under plain keys, rebuilt; anything else is null. */
function parseStats(v: unknown): GameStats | null {
  if (!isRecord(v) || Array.isArray(v)) return null;
  const entries = Object.entries(v);
  if (entries.length === 0 || entries.length > STATS_MAX_KEYS) return null;
  const out: Record<string, number> = {};
  for (const [k, n] of entries) {
    if (!STAT_KEY.test(k) || typeof n !== 'number' || !Number.isFinite(n)) return null;
    out[k] = n;
  }
  return out;
}

/**
 * Parse what the page posted. Anything malformed or unknown is `null`, and a
 * known message comes back rebuilt from its declared fields only — a score is
 * what gets submitted, so no stray field rides along with it.
 */
export function parseGameMessage(raw: string): GameMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(m)) return null;
  switch (m.type) {
    case 'game:ready':
    case 'game:start':
      return { type: m.type };
    case 'game:phase':
      return PHASES.includes(m.phase as GamePhase) ? { type: m.type, phase: m.phase as GamePhase } : null;
    case 'game:haptic':
      return HAPTICS.includes(m.style as HapticStyle) ? { type: m.type, style: m.style as HapticStyle } : null;
    case 'game:over': {
      if (!isCount(m.score) || !isCount(m.ticks) || !isCount(m.revives) || !isCount(m.revivesLeft)) return null;
      if (m.hit !== null && (typeof m.hit !== 'string' || m.hit.length > HIT_MAX_LENGTH)) return null;
      // `+ 0` turns a -0 into 0.
      const over = {
        type: m.type,
        score: m.score + 0,
        ticks: m.ticks,
        hit: m.hit,
        revives: m.revives,
        revivesLeft: m.revivesLeft,
      } as const;
      const stats = parseStats(m.stats);
      return stats ? { ...over, stats } : over;
    }
    default:
      return null;
  }
}

/** Parse what the host sent, on the page side. */
export function parseHostMessage(m: unknown): HostMessage | null {
  if (!isRecord(m)) return null;
  switch (m.type) {
    case 'host:init':
      return isCount(m.hi) ? { type: m.type, hi: m.hi } : null;
    case 'host:revive':
    case 'host:restart':
    case 'host:reset':
    case 'host:pause':
    case 'host:resume':
      return { type: m.type };
    case 'host:sound':
      return typeof m.on === 'boolean' ? { type: m.type, on: m.on } : null;
    default:
      return null;
  }
}

/**
 * The script the host injects to deliver a message. `window.__host` is the
 * page's receiver; the trailing `true` is what react-native-webview expects an
 * injected script to evaluate to.
 *
 * A message sent before the page installs `__host` is dropped, so the host
 * speaks only in reply to `game:ready`.
 */
export function hostScript(message: HostMessage): string {
  return `window.__host&&window.__host(${JSON.stringify(message)});true;`;
}
