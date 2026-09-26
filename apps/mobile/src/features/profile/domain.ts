/**
 * The player profile — who someone is on a leaderboard. Stored as
 * `users/{uid}.profile` and validated by `isValidProfile` in
 * `apps/mobile/firestore.rules`; every rule below has its twin there.
 *
 * Pure: no runtime imports, so it loads under `node --test` as is.
 */
import type { Campus } from '@skkuverse/shared';

export interface UserProfile {
  campus: Campus;
  /** Shared by every in-app game; null until the first leaderboard entry. */
  nickname: string | null;
}

const CAMPUSES: readonly Campus[] = ['hssc', 'nsc'];

// ── Nickname ─────────────────────────────────────────────────────────

/** Same pattern as the rules' `isValidProfile`. Hangul here means whole syllables only. */
export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]{2,12}$/;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

export type NicknameCheck = 'ok' | 'tooShort' | 'tooLong' | 'invalidChars';

/** Trimmed and composed (NFC): pasted text can carry Hangul as separate jamo. */
export function normalizeNickname(input: string): string {
  return input.normalize('NFC').trim();
}

export function validateNickname(input: string): NicknameCheck {
  const n = normalizeNickname(input);
  if (n.length < NICKNAME_MIN) return 'tooShort';
  if (n.length > NICKNAME_MAX) return 'tooLong';
  return NICKNAME_PATTERN.test(n) ? 'ok' : 'invalidChars';
}

// ── Masked email ─────────────────────────────────────────────────────

/**
 * What a leaderboard shows of the email: up to three leading [a-z0-9]
 * characters of the local part. The rules check this is a prefix of the
 * signed-in address, and allow nothing else in it, so it stops at the first
 * other character. Null when not even one is left.
 */
export function emailPrefixOf(email: string | null | undefined): string | null {
  const at = email?.indexOf('@') ?? -1;
  if (!email || at <= 0) return null;
  const prefix = /^[a-z0-9]{0,3}/.exec(email.slice(0, at).toLowerCase())![0];
  return prefix.length > 0 ? prefix : null;
}

export function maskedEmail(prefix: string): string {
  return `${prefix}***`;
}

// ── Reading ──────────────────────────────────────────────────────────

/** The profile inside a users/{uid} document; null when there is none to speak of. */
export function parseProfile(userDoc: Record<string, unknown> | undefined): UserProfile | null {
  const p = userDoc?.profile;
  if (typeof p !== 'object' || p === null) return null;
  const { campus, nickname } = p as Record<string, unknown>;
  if (!CAMPUSES.includes(campus as Campus)) return null;
  return { campus: campus as Campus, nickname: typeof nickname === 'string' ? nickname : null };
}

// ── Setup ────────────────────────────────────────────────────────────

export type ProfileStep = 'campus' | 'nickname';

/** The questions still to ask, in order. */
export function missingSteps(profile: UserProfile | null, opts: { requireNickname: boolean }): ProfileStep[] {
  const steps: ProfileStep[] = profile ? [] : ['campus'];
  if (opts.requireNickname && !profile?.nickname) steps.push('nickname');
  return steps;
}

/**
 * What this device already knows, offered as the setup screen's starting
 * answer — the player still confirms it. Only after the notices onboarding
 * finished here: before that `preferredCampus` is the store's default. Not
 * saved unasked, because a remote restore of that onboarding does not bring
 * the campus back, so the campus here may be that default after all.
 */
export function prefillFromDevice(settings: {
  onboardingCompleted: boolean;
  preferredCampus: Campus;
}): Pick<UserProfile, 'campus'> | null {
  return settings.onboardingCompleted ? { campus: settings.preferredCampus } : null;
}

// ── The setup screen's flow ──────────────────────────────────────────

export interface SetupState {
  steps: readonly ProfileStep[];
  current: ProfileStep | 'done';
  campus: Campus | null;
  nickname: string;
}

export type SetupAction =
  | { type: 'SET_CAMPUS'; campus: Campus }
  | { type: 'SET_NICKNAME'; nickname: string }
  | { type: 'NEXT' }
  | { type: 'PREV' };

export function initialSetup(
  steps: readonly ProfileStep[],
  opts: { nickname: string | null; prefill?: Pick<UserProfile, 'campus'> | null },
): SetupState {
  return { steps, current: steps[0] ?? 'done', campus: opts.prefill?.campus ?? null, nickname: opts.nickname ?? '' };
}

/** Whether the current step has an answer good enough to move on. */
export function canAdvance(s: SetupState): boolean {
  switch (s.current) {
    case 'campus':
      return s.campus !== null;
    case 'nickname':
      return validateNickname(s.nickname) === 'ok';
    case 'done':
      return false;
  }
}

function move(s: SetupState, by: 1 | -1): SetupState {
  if (s.current === 'done') return s;
  const i = s.steps.indexOf(s.current) + by;
  if (i < 0) return s;
  return { ...s, current: s.steps[i] ?? 'done' };
}

export function setupReducer(s: SetupState, a: SetupAction): SetupState {
  switch (a.type) {
    case 'SET_CAMPUS':
      return { ...s, campus: a.campus };
    case 'SET_NICKNAME':
      return { ...s, nickname: a.nickname };
    case 'NEXT':
      return canAdvance(s) ? move(s, 1) : s;
    case 'PREV':
      return move(s, -1);
  }
}

/** What the finished flow answered — only the steps it asked. */
export function answersOf(s: SetupState): Partial<UserProfile> {
  const out: Partial<UserProfile> = {};
  if (s.steps.includes('campus') && s.campus) out.campus = s.campus;
  if (s.steps.includes('nickname')) out.nickname = normalizeNickname(s.nickname);
  return out;
}
