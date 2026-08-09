import { describe, it, expect } from 'vitest';
import { filterPickerSources, isUnsupportedSource } from '../sourceFilters';
import type { TabSource } from '../types';

const crawlable: TabSource = {
  id: 'cse-undergrad',
  name: '소프트웨어학과(학부생)',
  campus: 'nsc',
  college: '소프트웨어융합대학',
  noticeAvailable: true,
  excludeReason: null,
  // Biconditional with excludeReason: no reason, no copy to resolve.
  excludeReasonText: null,
};

const unsupported: TabSource = {
  id: 'med-undergrad',
  name: '의과대학(학부생)',
  campus: 'nsc',
  college: '의과대학',
  noticeAvailable: false,
  excludeReason: 'loginRequired',
  excludeReasonText: '로그인이 필요한 사이트예요',
};

describe('filterPickerSources', () => {
  it('keeps unsupported entries when showUnsupported=true (onboarding context)', () => {
    const out = filterPickerSources([crawlable, unsupported], { showUnsupported: true });
    expect(out.map((s) => s.id)).toEqual(['cse-undergrad', 'med-undergrad']);
  });

  it('drops unsupported entries when showUnsupported=false (main picker context)', () => {
    const out = filterPickerSources([crawlable, unsupported], { showUnsupported: false });
    expect(out.map((s) => s.id)).toEqual(['cse-undergrad']);
  });

  it('returns a fresh array (does not mutate input)', () => {
    const input = [crawlable, unsupported];
    const out = filterPickerSources(input, { showUnsupported: true });
    expect(out).not.toBe(input);
  });

  it('handles empty input', () => {
    expect(filterPickerSources([], { showUnsupported: false })).toEqual([]);
    expect(filterPickerSources([], { showUnsupported: true })).toEqual([]);
  });
});

describe('isUnsupportedSource', () => {
  it('true for sources with reason', () => {
    expect(isUnsupportedSource(unsupported)).toBe(true);
  });

  it('false for crawlable sources', () => {
    expect(isUnsupportedSource(crawlable)).toBe(false);
  });

  it('false for inconsistent state (defensive — codegen should reject)', () => {
    // noticeAvailable=false but no reason — codegen prevents this, but the
    // predicate stays conservative and refuses to flag without a reason.
    const malformed: TabSource = {
      ...unsupported,
      excludeReason: null,
    };
    expect(isUnsupportedSource(malformed)).toBe(false);
  });
});
