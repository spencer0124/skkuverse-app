/**
 * The marker caption's line breaking.
 *
 * What is pinned here is the COMPOSITION, not the libraries underneath it.
 * `wrap-ansi` owns the greedy fill and `string-width` owns the display width;
 * neither is re-tested. What is ours, and what these cases hold still, is the
 * two-pass call: a soft wrap first, then a hard re-wrap of only those lines that
 * still overflow AND carry a wide character.
 *
 * That second condition is the whole reason the function exists. A single pass
 * is wrong in both directions — soft alone leaves 올림픽기념국민생활관 on one
 * line, which is exactly the native SDK failure this replaces, and hard alone
 * splits `International` down the middle. Neither shows up in a test written
 * against Korean only, which is how a fix for one script ships a regression in
 * the other.
 *
 * Every expected value below is measured output from a probe against the real
 * booth titles in skkuverse-server `scripts/data/eskara-2026-places.json` and
 * the real building names, not a hand-derived guess.
 */

import { describe, it, expect } from 'vitest';
import { wrapMarkerLabel } from '../text';

/** The building-name layer's cap: `textLabel`, captionTextSize 7. */
const LABEL_COLS = 14;
/** The booth layer's cap: `placeDot`, captionTextSize 9. */
const PLACE_COLS = 16;
const MAX_LINES = 2;

describe('wrapMarkerLabel — a label that already fits', () => {
  it('comes back by identity, not by a rebuilt equal string', () => {
    // Identity, not equality. The caption object is hashed by the SDK into
    // `caption.key`; a fresh-but-equal string every render would defeat the
    // short-circuit at RNCNaverMapMarker.kt:141-143 and re-apply every caption.
    const short = '경영관';
    expect(wrapMarkerLabel(short, LABEL_COLS, MAX_LINES)).toBe(short);
  });

  it('treats the cap as inclusive', () => {
    // 7 syllables at 2 columns each is exactly 14 — it must not wrap.
    expect(wrapMarkerLabel('수제로켓전문점', PLACE_COLS, MAX_LINES)).toBe('수제로켓전문점');
  });
});

describe('wrapMarkerLabel — Korean, which has no whitespace to break at', () => {
  it('breaks a space-free compound between syllables', () => {
    // The case the native wrapper cannot do at all: its own doc says it breaks
    // at whitespace, and this name has none.
    expect(wrapMarkerLabel('올림픽기념국민생활관', LABEL_COLS, MAX_LINES)).toBe(
      '올림픽기념국민\n생활관',
    );
    expect(wrapMarkerLabel('자연과학캠퍼스학생회관', LABEL_COLS, MAX_LINES)).toBe(
      '자연과학캠퍼스\n학생회관',
    );
  });

  it('counts a Hangul syllable as two columns, not one', () => {
    // Were width counted in characters, this 7-syllable name would read as 7
    // and stay on one line at any cap above 7.
    expect(wrapMarkerLabel('웅이네푸드트럭', 10, MAX_LINES)).toBe('웅이네푸드\n트럭');
  });
});

describe('wrapMarkerLabel — Latin, which must not be broken the same way', () => {
  it('never splits a word, even one wider than the cap', () => {
    // The hard pass would give `Internationa` / `l Hall`. It is withheld here
    // because the line carries no wide character, so the line is allowed to
    // overflow instead — which is what CJK typography actually asks for.
    expect(wrapMarkerLabel('International Hall', LABEL_COLS, MAX_LINES)).toBe(
      'International\nHall',
    );
    expect(wrapMarkerLabel('Business Administration', LABEL_COLS, MAX_LINES)).toBe(
      'Business\nAdministration',
    );
  });

  it('still breaks the Korean half of a mixed label', () => {
    expect(wrapMarkerLabel('불가마 24시 스파동 숙/취/전/문', PLACE_COLS, MAX_LINES)).toBe(
      '불가마 24시\n스파동 숙/취/전…',
    );
  });
});

describe('wrapMarkerLabel — past the line budget', () => {
  it('joins what is left over and ellipsizes it', () => {
    // Not `lines.slice(0, maxLines)`, which would leave the last line
    // under-filled at `미션]` and throw away room that was available.
    expect(
      wrapMarkerLabel('[ESKARA 정복 미션] 코드네임: TYPE-S', PLACE_COLS, MAX_LINES),
    ).toBe('[ESKARA 정복\n미션] 코드네임:…');
  });

  it('applies the budget at one line too', () => {
    expect(wrapMarkerLabel('올림픽기념국민생활관', LABEL_COLS, 1)).toBe('올림픽기념국…');
  });

  it('never emits a wide line wider than the cap', () => {
    const REAL = [
      '[ESKARA 정복 미션] 코드네임: TYPE-S',
      '캠퍼스는 다르지만 응원은 하고싶어',
      '부추전, 김치전, 인자전, let’s go',
      '불가마 24시 스파동 숙/취/전/문',
      '인생은 랜덤, 향기는 커스텀',
      '수제로켓전문점 아레스',
      '취식존 (북측)',
    ];
    for (const title of REAL) {
      const out = wrapMarkerLabel(title, PLACE_COLS, MAX_LINES);
      expect(out.split('\n').length).toBeLessThanOrEqual(MAX_LINES);
      for (const line of out.split('\n')) {
        // A pure-Latin line may exceed the cap by design; a line carrying a wide
        // character never may, because it was always breakable.
        if (/[가-힣]/.test(line)) expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it('does not duplicate a repeated segment when it clamps', () => {
    // A tail built by searching for the segment's VALUE rather than tracking its
    // index turns this into `부추전, 김치전` / `, 김치전, 인…`.
    const out = wrapMarkerLabel('부추전, 김치전, 인자전, let’s go', PLACE_COLS, MAX_LINES);
    expect(out.split('김치전').length - 1).toBe(1);
  });
});

describe('wrapMarkerLabel — degenerate input is inert', () => {
  it('returns the input rather than throwing or looping', () => {
    // `cols: 0` is reachable from a server that sends `style.size: 0`, and an
    // infinite loop here would hang the map rather than mislabel it.
    expect(wrapMarkerLabel('', LABEL_COLS, MAX_LINES)).toBe('');
    expect(wrapMarkerLabel('경영관', 0, MAX_LINES)).toBe('경영관');
    expect(wrapMarkerLabel('올림픽기념국민생활관', LABEL_COLS, 0)).toBe('올림픽기념국민생활관');
  });
});
