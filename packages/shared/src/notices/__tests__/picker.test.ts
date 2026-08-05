import { describe, it, expect } from 'vitest';
import {
  NOTICE_MULTI_SOURCE_LIMIT,
  computeOnboardingPickerSeed,
  resolveAllFollowedSourceIds,
  resolvePickerSelection,
} from '../picker';
import type { NoticeTab } from '../types';

function fixedTab(key: string, sourceId: string): NoticeTab {
  return {
    key,
    label: key,
    tabMode: 'fixed',
    fixed: { sourceId, name: sourceId, campus: 'both' },
  };
}

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

describe('resolveAllFollowedSourceIds', () => {
  const academic = fixedTab('academic', 'skku-academic');
  const scholarship = fixedTab('scholarship', 'skku-scholarship');
  const dept = pickerTab(
    'dept',
    [
      { id: 'cs', campus: 'nsc' },
      { id: 'sw', campus: 'nsc' },
      { id: 'econ', campus: 'hssc' },
    ],
    ['econ'],
    { hssc: [], nsc: [] },
  );
  const library = pickerTab(
    'library',
    [
      { id: 'lib-all', campus: null },
      { id: 'lib-hssc', campus: 'hssc' },
    ],
    ['lib-all'],
    { hssc: [], nsc: [] },
  );

  it('unions fixed sourceIds with resolved picker selections', () => {
    expect(
      resolveAllFollowedSourceIds([academic, dept, library], {
        dept: ['cs', 'sw'],
        library: ['lib-hssc'],
      }),
    ).toEqual(['cs', 'lib-hssc', 'skku-academic', 'sw']);
  });

  it('falls back to picker defaults for tabs the user never touched', () => {
    // No `dept` / `library` entry in selections — each picker still
    // contributes, exactly as the tab itself would render.
    expect(resolveAllFollowedSourceIds([academic, dept, library], {})).toEqual([
      'econ',
      'lib-all',
      'skku-academic',
    ]);
  });

  it('dedupes a source reachable from two tabs', () => {
    const alsoCs = pickerTab(
      'favorites',
      [{ id: 'cs', campus: 'nsc' }],
      ['cs'],
      { hssc: [], nsc: [] },
    );
    const ids = resolveAllFollowedSourceIds([dept, alsoCs], { dept: ['cs'] });
    expect(ids).toEqual(['cs']);
  });

  it('is order-stable regardless of tab order (cache-key safety)', () => {
    const selections = { dept: ['sw', 'cs'] };
    expect(
      resolveAllFollowedSourceIds([academic, scholarship, dept], selections),
    ).toEqual(
      resolveAllFollowedSourceIds([dept, scholarship, academic], selections),
    );
  });

  it('returns [] for an empty tab list', () => {
    expect(resolveAllFollowedSourceIds([], {})).toEqual([]);
  });

  it('drops stored ids that no longer exist in the server config', () => {
    expect(resolveAllFollowedSourceIds([dept], { dept: ['ghost'] })).toEqual([
      'econ',
    ]);
  });

  // Regression guard for the reason "전체" search 400'd on first try: the
  // server caps GET /notices at NOTICE_MULTI_SOURCE_LIMIT ids. Today's tab
  // config lands exactly on that ceiling (5 fixed + 5 dept + 3 library +
  // 2 dorm + 5 general = 20), so there is zero headroom — this asserts the
  // arithmetic that makes the union fit, and fails loudly if a tab is added
  // or a picker's maxSelection grows without raising the server constant.
  it('a maxed-out follow set still fits NOTICE_MULTI_SOURCE_LIMIT', () => {
    const fixedTabs = ['academic', 'scholarship', 'career', 'recruitment', 'event'].map(
      (key) => fixedTab(key, `src-${key}`),
    );
    const maxedPicker = (key: string, max: number) =>
      pickerTab(
        key,
        Array.from({ length: max }, (_, i) => ({
          id: `${key}-${i}`,
          campus: null,
        })),
        [],
        { hssc: [], nsc: [] },
        max,
      );
    const tabs = [
      ...fixedTabs,
      maxedPicker('dept', 5),
      maxedPicker('library', 3),
      maxedPicker('dorm', 2),
      maxedPicker('general', 5),
    ];
    const selections = {
      dept: ['dept-0', 'dept-1', 'dept-2', 'dept-3', 'dept-4'],
      library: ['library-0', 'library-1', 'library-2'],
      dorm: ['dorm-0', 'dorm-1'],
      general: ['general-0', 'general-1', 'general-2', 'general-3', 'general-4'],
    };
    const ids = resolveAllFollowedSourceIds(tabs, selections);
    expect(ids).toHaveLength(20);
    expect(ids.length).toBeLessThanOrEqual(NOTICE_MULTI_SOURCE_LIMIT);
  });
});
