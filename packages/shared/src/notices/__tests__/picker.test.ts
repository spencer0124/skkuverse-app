import { describe, it, expect } from 'vitest';
import {
  computeOnboardingPickerSeed,
  resolvePickerSelection,
} from '../picker';
import type { NoticeTab } from '../types';

function pickerTab(
  key: string,
  sources: { id: string; campus: string | null }[],
  defaultIds: string[],
  campusDefaultIds: { hssc: string[]; nsc: string[] },
  maxSelection = 5,
): NoticeTab {
  return {
    key,
    label: key,
    tabMode: 'picker',
    picker: {
      sources: sources.map((s) => ({
        id: s.id,
        name: s.id,
        campus: s.campus,
        college: null,
        noticeAvailable: true,
        excludeReason: null,
        excludeReasonText: null,
      })),
      maxSelection,
      defaultIds,
      campusDefaultIds,
    },
  };
}

describe('computeOnboardingPickerSeed', () => {
  const libraryTab = pickerTab(
    'library',
    [
      { id: 'lib-hssc', campus: 'hssc' },
      { id: 'lib-nsc', campus: 'nsc' },
      { id: 'lib-all', campus: null },
    ],
    ['lib-all'],
    { hssc: ['lib-hssc'], nsc: ['lib-nsc'] },
    3,
  );

  const dormTab = pickerTab(
    'dorm',
    [
      { id: 'dorm-hssc', campus: 'hssc' },
      { id: 'dorm-nsc', campus: 'nsc' },
    ],
    [],
    { hssc: ['dorm-hssc'], nsc: ['dorm-nsc'] },
    2,
  );

  const deptTab = pickerTab(
    'dept',
    [{ id: 'cs', campus: 'nsc' }],
    [],
    { hssc: [], nsc: [] },
    5,
  );

  const generalTab = pickerTab(
    'general',
    [{ id: 'health', campus: null }],
    [],
    { hssc: [], nsc: [] },
    5,
  );

  it('library hssc → common + hssc-specific in common-first order', () => {
    expect(computeOnboardingPickerSeed(libraryTab, 'hssc')).toEqual([
      'lib-all',
      'lib-hssc',
    ]);
  });

  it('library nsc → common + nsc-specific', () => {
    expect(computeOnboardingPickerSeed(libraryTab, 'nsc')).toEqual([
      'lib-all',
      'lib-nsc',
    ]);
  });

  it('dorm hssc → only campus-specific (no common)', () => {
    expect(computeOnboardingPickerSeed(dormTab, 'hssc')).toEqual(['dorm-hssc']);
  });

  it('dorm nsc → only campus-specific', () => {
    expect(computeOnboardingPickerSeed(dormTab, 'nsc')).toEqual(['dorm-nsc']);
  });

  it('dept tab with no defaults → empty seed regardless of campus', () => {
    expect(computeOnboardingPickerSeed(deptTab, 'hssc')).toEqual([]);
    expect(computeOnboardingPickerSeed(deptTab, 'nsc')).toEqual([]);
  });

  it('general tab with no defaults → empty seed', () => {
    expect(computeOnboardingPickerSeed(generalTab, 'hssc')).toEqual([]);
  });

  it('fixed tab → always empty (defensive)', () => {
    const fixed: NoticeTab = {
      key: 'academic',
      label: '학사',
      tabMode: 'fixed',
      fixed: { sourceId: 'x', name: 'X', campus: 'both' },
    };
    expect(computeOnboardingPickerSeed(fixed, 'hssc')).toEqual([]);
  });

  it('caps at maxSelection when union exceeds it', () => {
    const tab = pickerTab(
      'crowded',
      [
        { id: 'a', campus: null },
        { id: 'b', campus: null },
        { id: 'c', campus: 'hssc' },
        { id: 'd', campus: 'hssc' },
      ],
      ['a', 'b'],
      { hssc: ['c', 'd'], nsc: [] },
      3,
    );
    expect(computeOnboardingPickerSeed(tab, 'hssc')).toEqual(['a', 'b', 'c']);
  });

  it('dedupes when common overlaps with campus-specific', () => {
    const tab = pickerTab(
      'overlap',
      [
        { id: 'shared', campus: null },
        { id: 'extra', campus: 'hssc' },
      ],
      ['shared'],
      { hssc: ['shared', 'extra'], nsc: [] },
      5,
    );
    expect(computeOnboardingPickerSeed(tab, 'hssc')).toEqual([
      'shared',
      'extra',
    ]);
  });

  it('filters ids not present in sources (defensive against stale config)', () => {
    const tab = pickerTab(
      'stale',
      [{ id: 'real', campus: null }],
      ['real', 'ghost'],
      { hssc: ['ghost'], nsc: [] },
      5,
    );
    expect(computeOnboardingPickerSeed(tab, 'hssc')).toEqual(['real']);
  });
});

describe('resolvePickerSelection (post-rename)', () => {
  const tab = pickerTab(
    'library',
    [
      { id: 'lib-all', campus: null },
      { id: 'lib-hssc', campus: 'hssc' },
    ],
    ['lib-all'],
    { hssc: ['lib-hssc'], nsc: [] },
    3,
  );

  it('returns stored when valid', () => {
    expect(resolvePickerSelection(tab, ['lib-hssc'])).toEqual(['lib-hssc']);
  });

  it('falls back to defaultIds (common only — does NOT merge campus)', () => {
    expect(resolvePickerSelection(tab, undefined)).toEqual(['lib-all']);
  });

  it('falls back to first source when defaults empty', () => {
    const empty = pickerTab(
      'empty-defaults',
      [{ id: 'first', campus: null }],
      [],
      { hssc: [], nsc: [] },
      3,
    );
    expect(resolvePickerSelection(empty, undefined)).toEqual(['first']);
  });
});
