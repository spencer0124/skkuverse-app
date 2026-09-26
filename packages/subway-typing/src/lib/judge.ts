import { isKeyPrefix, toKeys } from './hangul';

/**
 * - `empty`: nothing typed.
 * - `ok`:    on the way to the station — every key so far is right.
 * - `wrong`: a key went astray; the player has to delete back to it.
 * - `done`:  the station name, exactly.
 */
export type Status = 'empty' | 'ok' | 'wrong' | 'done';

/** How to draw each character of the station name. */
export type Mark = 'hit' | 'miss' | 'rest';

export interface Judgement {
  status: Status;
  /** One per character of the target. */
  marks: Mark[];
  /** Keys of the input that match the target, for the live speed readout. */
  goodKeys: number;
  /** Keys in the input, right or wrong. */
  typed: number;
}

export function judge(input: string, target: string): Judgement {
  const want = [...target];
  const got = [...input.normalize('NFC')];
  const wantKeys = toKeys(target);
  const marks: Mark[] = want.map(() => 'rest');
  const typed = toKeys(input).length;

  if (got.length === 0) return { status: 'empty', marks, goodKeys: 0, typed };
  if (got.join('') === target) {
    return { status: 'done', marks: want.map(() => 'hit'), goodKeys: wantKeys.length, typed };
  }

  // Walk the input one character at a time. A character that equals the
  // target's is settled; the last one may still be mid-composition, which is
  // fine as long as its keys stay on course.
  let keys: string[] = [];
  let goodKeys = 0;
  for (let i = 0; i < got.length; i++) {
    keys = keys.concat(toKeys(got[i]!));
    if (!isKeyPrefix(keys, wantKeys)) {
      if (i < want.length) marks[i] = 'miss';
      return { status: 'wrong', marks, goodKeys, typed };
    }
    goodKeys = keys.length;
    if (got[i] === want[i]) marks[i] = 'hit';
  }
  return { status: 'ok', marks, goodKeys, typed };
}

/**
 * A typo is counted when the player deletes their way out of a wrong state —
 * once per slip, however many keys it takes to back out.
 *
 * Counting on entering `wrong` instead would punish the 천지인 keypad many
 * Android phones default to: there ㅊ is ㅈ pressed twice, so the field passes
 * through a wrong ㅈ on its way to a right ㅊ with no deletion at all.
 */
export function isTypo(prev: Judgement, next: Judgement): boolean {
  return prev.status === 'wrong' && next.status !== 'wrong' && next.typed < prev.typed;
}

/**
 * Some Android keyboards commit the syllable they were composing *after* the
 * field has been cleared, so the tail of the station just reached lands in
 * the empty field for the next one. On the first change after an arrival,
 * a value that is the end of the last name and no start of the next is that
 * echo, not the player's typing.
 */
export function isStaleCommit(value: string, previous: string, next: string): boolean {
  if (!value || !previous.endsWith(value)) return false;
  return judge(value, next).status === 'wrong';
}
