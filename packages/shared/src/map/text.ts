/**
 * Picking one string out of an `I18nText`.
 *
 * One function because three call sites need it — the marker caption, the list
 * row and the peek sheet — and they diverged once already: the marker layer
 * folded `zh` into Korean while the sheet honoured it, which is how a map whose
 * booth pins were Korean and whose booth sheet was Chinese became possible.
 *
 * The server ships every language it holds rather than resolving against
 * `Accept-Language`, because its two producers hold different sets: a building
 * carries `{ko, en}` while an ops-authored booth title may also carry `zh`.
 * Resolving server-side would mean picking one and discarding the rest, so the
 * pick happens here, against the app's own language setting.
 */

import cliTruncate from 'cli-truncate';
import stringWidth from 'string-width';
import wrapAnsi from 'wrap-ansi';

import type { AppLanguage } from '../store/settings';
import type { I18nText } from '../types/map';

/**
 * `||` rather than `??` throughout: a missing translation upstream is the EMPTY
 * STRING, not `null`. Both writers of the buildings collection coalesce a
 * missing English name to `''`, so `text.en ?? text.ko` is dead code that ships
 * blank labels — and TypeScript cannot flag it, because `en` is declared
 * non-optional.
 */
export function pickI18nText(text: I18nText, lang: AppLanguage): string {
  if (lang === 'en') return text.en || text.ko;
  if (lang === 'zh') return text.zh || text.ko;
  return text.ko;
}

/**
 * Breaking a marker caption onto at most `maxLines` lines of `cols` columns.
 *
 * The caption is the Naver SDK's NATIVE `caption` prop, not a React `<Text>`, so
 * `numberOfLines` and `ellipsizeMode` do not exist on it and rendering it as a
 * custom view is closed off (the Android bitmap-snapshot race, across ~137
 * buildings and ~100 booths at once). The SDK's own `requestedWidth` is the only
 * native knob, and its doc says it breaks at WHITESPACE — which Korean compound
 * names do not have. 올림픽기념국민생활관 is 20 columns and zero spaces, so the
 * native wrapper leaves it on one line no matter what width it is given.
 *
 * Hence: the breaks go into the string, before it reaches `caption.text`.
 *
 * `cols` counts DISPLAY columns, not characters — a Hangul syllable is 2. In
 * characters, 경영대학주점부스 (8) and `Booth Alpha Bravo` (17) look nothing
 * alike while rendering at almost the same width.
 *
 * The fill and the width model are `wrap-ansi` and `string-width`; neither is
 * reimplemented here. What IS here is the two-pass call, because one pass is
 * wrong in both directions:
 *
 * - `hard: false` alone leaves a space-free Korean compound unbroken, which is
 *   the native failure this exists to replace.
 * - `hard: true` alone splits `International Hall` into `Internationa` / `l Hall`.
 *
 * So: wrap soft, then re-wrap hard ONLY those lines that still overflow and
 * carry a wide character. A pure-Latin line over the cap is left to overflow,
 * which is what CJK line breaking actually prescribes.
 */

/**
 * Characters that may be broken between: Hangul (syllables and jamo), CJK
 * ideographs, kana, CJK punctuation and fullwidth forms.
 *
 * A test, never a transform — it decides whether the hard pass is allowed to run
 * on a line, and nothing else. Latin, digits and punctuation are absent on
 * purpose: those are what must NOT be split mid-token.
 */
const WIDE = /[ᄀ-ᇿ　-〿぀-ヿ㄰-㆏㐀-䶿一-鿿가-힣＀-￯]/;

export function wrapMarkerLabel(text: string, cols: number, maxLines: number): string {
  // `cols: 0` is reachable from a bad `style` on the wire, and `wrap-ansi` would
  // spin on it. Returning the input mislabels the map; looping hangs it.
  if (!text || cols < 1 || maxLines < 1) return text;
  // Identity, not a rebuilt equal string: the SDK hashes the caption object into
  // `caption.key` and short-circuits on it (RNCNaverMapMarker.kt:141-143).
  if (stringWidth(text) <= cols) return text;

  const lines = wrapAnsi(text, cols, { hard: false, trim: true })
    .split('\n')
    .flatMap((line) =>
      stringWidth(line) > cols && WIDE.test(line)
        ? wrapAnsi(line, cols, { hard: true, trim: true }).split('\n')
        : [line],
    );

  if (lines.length <= maxLines) return lines.join('\n');

  // Join what is left and truncate it, rather than slicing whole lines away. The
  // slice would leave the last line under-filled — `미션]` where `미션] 코드네임:…`
  // fits — throwing away room the cap had already allowed.
  const head = lines.slice(0, maxLines - 1);
  const tail = cliTruncate(lines.slice(maxLines - 1).join(' '), cols);
  return [...head, tail].join('\n');
}
