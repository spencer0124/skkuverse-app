import {
  computeOnboardingPickerSeed,
  type Campus,
  type NoticeTabsConfig,
} from '@skkuverse/shared';

/**
 * Onboarding wizard에서 모은 dept 선택 + campus 정보를 SSOT 기록용
 * pickerSelections 형태로 조립.
 *
 * - dept: primary(없으면 sentinel '') + interests, dedup, server의 maxSelection로 cap.
 *         derive가 falsy id 필터링이라 ''는 안전.
 * - library/dorm: campus-aware seed (computeOnboardingPickerSeed).
 * - general: 서버에 default 미설정이라 키 생략 → derive가 0 topics emit
 *            (명시적 빈배열 시 settings 화면에서 "사용자 opt-out"으로 오해 가능).
 *
 * prepareCategoryStep / handleComplete 양쪽에서 호출. seededPickerSelections
 * 캐싱이 우선이지만 fallback 경로(declined without seed)에서도 동일 결과
 * 보장을 위해 동일 util 사용.
 */
export function assembleOnboardingPickerSelections(args: {
  campus: Campus;
  primaryDeptId: string | null;
  interestDeptIds: string[];
  tabsConfig: NoticeTabsConfig | undefined;
}): Record<string, string[]> {
  const { campus, primaryDeptId, interestDeptIds, tabsConfig } = args;

  const combined: string[] = [];
  const seen = new Set<string>();
  if (primaryDeptId === null) {
    combined.push('');
  } else {
    combined.push(primaryDeptId);
    seen.add(primaryDeptId);
  }
  for (const id of interestDeptIds) {
    if (!seen.has(id)) {
      seen.add(id);
      combined.push(id);
    }
  }
  const deptTab = tabsConfig?.tabs.find((tab) => tab.key === 'dept');
  const maxPicks = deptTab?.picker?.maxSelection ?? combined.length;
  const seedDeptIds = combined.slice(0, maxPicks);

  const pickerSelections: Record<string, string[]> = { dept: seedDeptIds };

  for (const seedKey of ['library', 'dorm']) {
    const tab = tabsConfig?.tabs.find((t) => t.key === seedKey);
    if (tab) {
      const seed = computeOnboardingPickerSeed(tab, campus);
      if (seed.length > 0) {
        pickerSelections[seedKey] = seed;
      }
    }
  }

  return pickerSelections;
}
