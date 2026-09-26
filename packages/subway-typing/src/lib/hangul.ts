/**
 * Hangul as keystrokes.
 *
 * A Korean IME shows a syllable while it is still being built, and the
 * syllable on screen is not always a prefix of the one being aimed at: on the
 * way to 사당 the field reads 삳, because ㄷ sits as a final consonant until the
 * ㅏ after it pulls it forward into the next block. Comparing strings would
 * call that a typo. Comparing the keys pressed does not — ㅅㅏㄷ is a prefix of
 * ㅅㅏㄷㅏㅇ — so every judgement in the game goes through `toKeys`.
 *
 * Keys are those of the standard two-set (두벌식) layout. A compound vowel or
 * final (ㅘ, ㄺ) is two presses and splits into two; a doubled consonant (ㄲ)
 * is one shifted press and stays one.
 */

const SYLLABLE_FIRST = 0xac00;
const SYLLABLE_LAST = 0xd7a3;

// Compatibility jamo, which is also what the IME shows for a lone consonant or
// vowel mid-composition (the ㄷ in 동ㄷ).
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
// Index 0 is "no final consonant".
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

const COMPOUND: Record<string, string> = {
  ㅘ: 'ㅗㅏ',
  ㅙ: 'ㅗㅐ',
  ㅚ: 'ㅗㅣ',
  ㅝ: 'ㅜㅓ',
  ㅞ: 'ㅜㅔ',
  ㅟ: 'ㅜㅣ',
  ㅢ: 'ㅡㅣ',
  ㄳ: 'ㄱㅅ',
  ㄵ: 'ㄴㅈ',
  ㄶ: 'ㄴㅎ',
  ㄺ: 'ㄹㄱ',
  ㄻ: 'ㄹㅁ',
  ㄼ: 'ㄹㅂ',
  ㄽ: 'ㄹㅅ',
  ㄾ: 'ㄹㅌ',
  ㄿ: 'ㄹㅍ',
  ㅀ: 'ㄹㅎ',
  ㅄ: 'ㅂㅅ',
};

function pushJamo(keys: string[], jamo: string): void {
  const split = COMPOUND[jamo];
  if (split) keys.push(...split);
  else keys.push(jamo);
}

/** The keys pressed to type `text`, one array entry per key. */
export function toKeys(text: string): string[] {
  const keys: string[] = [];
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    if (code >= SYLLABLE_FIRST && code <= SYLLABLE_LAST) {
      const offset = code - SYLLABLE_FIRST;
      pushJamo(keys, INITIALS[Math.floor(offset / 588)]!);
      pushJamo(keys, MEDIALS[Math.floor((offset % 588) / 28)]!);
      const final = FINALS[offset % 28]!;
      if (final) pushJamo(keys, final);
    } else {
      pushJamo(keys, ch);
    }
  }
  return keys;
}

/** Whether `head` is a prefix of `whole`, key for key. */
export function isKeyPrefix(head: readonly string[], whole: readonly string[]): boolean {
  if (head.length > whole.length) return false;
  return head.every((key, i) => key === whole[i]);
}
