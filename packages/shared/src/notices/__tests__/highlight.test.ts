// Unit tests for the search-result highlight helper.
//
// highlightMatches(text, query) → segments[]
// Each segment is { text, matched }. Renderers walk the segments and wrap
// matched ones in a styled <Text>. Pure function — no React import.

import { describe, expect, it } from 'vitest';
import { highlightMatches } from '../highlight';

describe('highlightMatches', () => {
  describe('empty / trivial inputs', () => {
    it('returns one unmatched segment when query is empty', () => {
      expect(highlightMatches('hello world', '')).toEqual([
        { text: 'hello world', matched: false },
      ]);
    });

    it('returns empty array when text is empty', () => {
      expect(highlightMatches('', 'foo')).toEqual([]);
    });

    it('returns empty array when both text and query are empty', () => {
      expect(highlightMatches('', '')).toEqual([]);
    });

    it('returns one unmatched segment when query is not in text', () => {
      expect(highlightMatches('hello world', 'xyz')).toEqual([
        { text: 'hello world', matched: false },
      ]);
    });

    it('returns one matched segment when query equals full text', () => {
      expect(highlightMatches('hello', 'hello')).toEqual([
        { text: 'hello', matched: true },
      ]);
    });
  });

  describe('case preservation (case-insensitive match, original casing in output)', () => {
    it('preserves "CS" when query is "cs"', () => {
      // Input "cs" matches "CS" via case-insensitive regex, but the rendered
      // segment must show "CS" (the original substring), not "cs".
      const result = highlightMatches('CS Department', 'cs');
      expect(result).toEqual([
        { text: 'CS', matched: true },
        { text: ' Department', matched: false },
      ]);
    });

    it('preserves mixed case across multiple matches', () => {
      const result = highlightMatches('CS Lab vs cs lab', 'cs');
      // Two matches: "CS" (uppercase) and "cs" (lowercase) — both kept verbatim.
      expect(result).toEqual([
        { text: 'CS', matched: true },
        { text: ' Lab vs ', matched: false },
        { text: 'cs', matched: true },
        { text: ' lab', matched: false },
      ]);
    });
  });

  describe('all-occurrences (every match in the text is highlighted)', () => {
    it('matches both occurrences of a Korean term', () => {
      // Two matches must both be highlighted — single-match impl would miss
      // the second "공지". Critical for "공지 공지 안내" style headers.
      const result = highlightMatches('[중요] 공지 — 공지 안내', '공지');
      expect(result).toEqual([
        { text: '[중요] ', matched: false },
        { text: '공지', matched: true },
        { text: ' — ', matched: false },
        { text: '공지', matched: true },
        { text: ' 안내', matched: false },
      ]);
    });

    it('handles three+ adjacent matches', () => {
      const result = highlightMatches('aaaa', 'aa');
      // matchAll on /aa/g advances past each match, so adjacent occurrences
      // produce non-overlapping matches: "aa" + "aa".
      expect(result).toEqual([
        { text: 'aa', matched: true },
        { text: 'aa', matched: true },
      ]);
    });
  });

  describe('escapeRegex sanity (user metachars stay literal)', () => {
    it('input "." matches a literal dot only, not every char', () => {
      // Without escape, `.` in regex matches any char and the whole title
      // becomes a single huge match. With escape, it matches only the
      // literal "." character.
      const result = highlightMatches('Linux . tutorial', '.');
      expect(result).toEqual([
        { text: 'Linux ', matched: false },
        { text: '.', matched: true },
        { text: ' tutorial', matched: false },
      ]);
    });

    it('input ".*" matches the literal two-char string only', () => {
      const result = highlightMatches('regex .* ref', '.*');
      expect(result).toEqual([
        { text: 'regex ', matched: false },
        { text: '.*', matched: true },
        { text: ' ref', matched: false },
      ]);
    });

    it('input "[" does not throw and does not match anything when absent', () => {
      // Bare `[` is an unterminated character class in regex — escapeRegex
      // must turn it into a literal `\[` so the RegExp constructor doesn't
      // throw.
      expect(() => highlightMatches('hello [world]', '[')).not.toThrow();
      const result = highlightMatches('hello [world]', '[');
      expect(result).toEqual([
        { text: 'hello ', matched: false },
        { text: '[', matched: true },
        { text: 'world]', matched: false },
      ]);
    });
  });

  describe('boundary conditions', () => {
    it('match at start of string', () => {
      const result = highlightMatches('공지사항입니다', '공지');
      expect(result).toEqual([
        { text: '공지', matched: true },
        { text: '사항입니다', matched: false },
      ]);
    });

    it('match at end of string', () => {
      const result = highlightMatches('오늘의 공지', '공지');
      expect(result).toEqual([
        { text: '오늘의 ', matched: false },
        { text: '공지', matched: true },
      ]);
    });
  });
});
