/**
 * Search-result highlight helper — pure, framework-agnostic.
 *
 * highlightMatches(text, query) walks `text` with a case-insensitive
 * regex built from the (literal-escaped) `query` and emits a flat array
 * of segments: each segment is either matched or unmatched. Renderers
 * map matched segments to a styled <Text> and unmatched ones to plain.
 *
 * Two non-obvious properties locked in by the test suite:
 *   1. ALL occurrences are returned — `matchAll` advances past each
 *      match so adjacent ones surface separately. A single-match impl
 *      would miss the second "공지" in "공지 — 공지 안내".
 *   2. ORIGINAL casing is preserved — the regex matches case-insensitively
 *      but each segment carries `m[0]` (the substring lifted from the
 *      original text), not the user's query string. So `query="cs"` on
 *      `text="CS Department"` yields a matched segment with text "CS".
 *
 * Regex metacharacters are escaped so user input like "." or "[" stays
 * literal — without escape, "." would match every character in the text
 * and "[" would throw a SyntaxError from the RegExp constructor.
 */

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(REGEX_METACHARS, '\\$&');
}

export function highlightMatches(
  text: string,
  query: string,
): HighlightSegment[] {
  if (text.length === 0) return [];
  if (query.length === 0) return [{ text, matched: false }];

  const re = new RegExp(escapeRegex(query), 'gi');
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return [{ text, matched: false }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), matched: false });
    }
    segments.push({ text: m[0], matched: true });
    cursor = start + m[0].length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}
