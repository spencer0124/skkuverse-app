import { describe, it, expect } from 'vitest';
import {
  recommendCollegeMates,
  findCollegeUmbrella,
} from '../collegeRecommendation';
import type { TabSource } from '../types';

function dept(overrides: Partial<TabSource> & Pick<TabSource, 'id' | 'name'>): TabSource {
  return {
    campus: 'nsc',
    college: null,
    noticeAvailable: true,
    excludeReason: null,
    ...overrides,
  };
}

const cse = dept({
  id: 'cse-undergrad',
  name: '소프트웨어학과(학부생)',
  college: '소프트웨어융합대학',
});
const cseUmbrella = dept({
  id: 'sw-undergrad',
  name: '소프트웨어융합대학(학부생)',
  college: '소프트웨어융합대학',
});
const electronics = dept({
  id: 'electronics-undergrad',
  name: '전자전기공학부(학부생)',
  college: '소프트웨어융합대학',
});
const arch = dept({ id: 'arch', name: '건축학과', college: '공과대학' });
const main = dept({ id: 'skku-main', name: '학부통합(학사)', college: null });
const med = dept({
  id: 'med',
  name: '의과대학',
  college: '의과대학',
  noticeAvailable: false,
  excludeReason: 'loginRequired',
});

const all = [cse, cseUmbrella, electronics, arch, main, med];

describe('recommendCollegeMates', () => {
  it('groups same-college mates separately from others', () => {
    const { recommended, others } = recommendCollegeMates(cse, all);
    expect(recommended.map((s) => s.id)).toEqual(['sw-undergrad', 'electronics-undergrad']);
    expect(others.map((s) => s.id)).toEqual(['arch', 'skku-main', 'med']);
  });

  it('excludes the primary itself from both buckets', () => {
    const { recommended, others } = recommendCollegeMates(cse, all);
    expect([...recommended, ...others].some((s) => s.id === cse.id)).toBe(false);
  });

  it('returns all sources as `others` when primary is null', () => {
    const { recommended, others } = recommendCollegeMates(null, all);
    expect(recommended).toEqual([]);
    expect(others.map((s) => s.id)).toEqual(all.map((s) => s.id));
  });

  it('returns all sources as `others` when primary has no college', () => {
    const { recommended, others } = recommendCollegeMates(main, all);
    expect(recommended).toEqual([]);
    // primary itself is in `all` but recommendCollegeMates only filters when
    // primary has a college — when primary's college is null, no split runs
    // and the whole list returns. (Caller should still avoid showing primary.)
    expect(others).toEqual(all);
  });

  it('preserves source order within each bucket', () => {
    // Reverse the order of inputs and check that order is still preserved
    // relative to the input sequence.
    const reversed = [...all].reverse();
    const { recommended, others } = recommendCollegeMates(cse, reversed);
    expect(recommended.map((s) => s.id)).toEqual(['electronics-undergrad', 'sw-undergrad']);
    expect(others.map((s) => s.id)).toEqual(['med', 'skku-main', 'arch']);
  });

  it('does not mutate the input array', () => {
    const input = [...all];
    recommendCollegeMates(cse, input);
    expect(input).toEqual(all);
  });
});

describe('findCollegeUmbrella', () => {
  it('finds the umbrella whose name contains the college string', () => {
    const result = findCollegeUmbrella(cse, all);
    expect(result?.id).toBe('sw-undergrad');
  });

  it('skips siblings that share the college but whose name does not match', () => {
    // electronics-undergrad shares the college but its name does not contain
    // "소프트웨어융합대학" — must not be returned as the umbrella.
    const result = findCollegeUmbrella(cse, all);
    expect(result?.id).not.toBe('electronics-undergrad');
  });

  it('returns null when primary has no college', () => {
    expect(findCollegeUmbrella(main, all)).toBe(null);
  });

  it('returns null when no umbrella exists for the college', () => {
    expect(findCollegeUmbrella(arch, all)).toBe(null);
  });

  it('refuses unsupported entries as umbrellas', () => {
    const malformedAll = [med, ...all];
    // Even if the unsupported entry were a perfect name match, never propose
    // it as the alternative — we'd be replacing one unsupported pick with
    // another.
    const fakePrimary = dept({
      id: 'med-undergrad',
      name: '의과대학(학부생)',
      college: '의과대학',
      noticeAvailable: false,
      excludeReason: 'loginRequired',
    });
    expect(findCollegeUmbrella(fakePrimary, malformedAll)).toBe(null);
  });
});
