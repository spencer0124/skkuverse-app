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

// ── The 건축학과 fallback — 2026-07 / 2026-09 department-picker bug ──────────
//
// These fixtures mirror the SERVER's categories.json, where the `dept` and
// `general` tabs carry NO defaultIds key at all. That makes rung 2 a dead rung
// for them, so any empty or unresolvable stored value drops to rung 3 and
// renders sources[0] — 'arch' (건축학과) for dept, 'health' for general.
// Reordering those arrays server-side silently changes which department a
// broken save impersonates, which is why both tabs are pinned here.
describe('resolvePickerSelection — the sources[0] fallback', () => {
  const deptTab = pickerTab(
    'dept',
    [
      { id: 'arch', campus: 'nsc' }, // 건축학과 — first by Korean collation
      { id: 'cs', campus: 'nsc' },
      { id: 'biz-undergrad', campus: 'hssc' },
    ],
    [], // server sends no defaultIds for dept
    { hssc: [], nsc: [] },
  );

  const generalTab = pickerTab(
    'general',
    [
      { id: 'health', campus: null },
      { id: 'lib-all', campus: null },
    ],
    [], // server sends no defaultIds for general either
    { hssc: [], nsc: [] },
  );

  it('falls back to sources[0] for a first-time user (stored undefined)', () => {
    expect(resolvePickerSelection(deptTab, undefined)).toEqual(['arch']);
    expect(resolvePickerSelection(generalTab, undefined)).toEqual(['health']);
  });

  // S2: '대표학과 스킵' sentinel with no interest depts. The doc is healthy,
  // yet the user still sees 건축학과 — a wholly separate route to the same
  // symptom as the ghost-doc case.
  it("falls back when stored is only the '' primary-skip sentinel", () => {
    expect(resolvePickerSelection(deptTab, [''])).toEqual(['arch']);
  });

  it('drops the sentinel but keeps real interest ids', () => {
    expect(resolvePickerSelection(deptTab, ['', 'cs'])).toEqual(['cs']);
  });

  it('falls back when every stored id has been retired server-side', () => {
    expect(resolvePickerSelection(deptTab, ['retired-dept'])).toEqual(['arch']);
  });

  it('falls back on an empty stored array', () => {
    expect(resolvePickerSelection(deptTab, [])).toEqual(['arch']);
  });

  // Instrumentation: rung 3 is kept (never blank the notices tab) but it must
  // no longer be silent. Reaching it means either a first-time user or a
  // broken save, and only telemetry tells those apart in the field — the
  // 2026-07 incident ran 84 days precisely because nothing reported this.
  it('invokes onFallback ONLY when rung 3 is reached', () => {
    let hits = 0;
    const count = () => {
      hits++;
    };

    resolvePickerSelection(deptTab, ['cs'], count);
    expect(hits).toBe(0); // rung 1 — stored is valid

    resolvePickerSelection(
      pickerTab('library', [{ id: 'lib-all', campus: null }], ['lib-all'], {
        hssc: [],
        nsc: [],
      }),
      undefined,
      count,
    );
    expect(hits).toBe(0); // rung 2 — server defaultIds exist

    resolvePickerSelection(deptTab, [''], count);
    expect(hits).toBe(1); // rung 3 — the 건축학과 path

    resolvePickerSelection(deptTab, undefined, count);
    expect(hits).toBe(2);
  });

  it('does not invoke onFallback when there are no sources to fall back to', () => {
    let hits = 0;
    const empty = pickerTab('dept', [], [], { hssc: [], nsc: [] });
    expect(resolvePickerSelection(empty, undefined, () => hits++)).toEqual([]);
    expect(hits).toBe(0);
  });
});
