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
