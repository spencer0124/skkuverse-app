import type { NoticeTabsConfig } from './notices.types';

export function showsOnboardingLanding({
  isAnonymous,
  onboardingCompleted,
}: {
  isAnonymous: boolean;
  onboardingCompleted: boolean;
}): boolean {
  return isAnonymous || !onboardingCompleted;
}

export function toSourceName(config: NoticeTabsConfig | undefined, sourceId: string): string | null {
  if (!config) return null;
  for (const tab of config.tabs) {
    if (tab.tabMode === 'fixed' && tab.fixed?.sourceId === sourceId) return tab.fixed.name;
    if (tab.tabMode === 'picker' && tab.picker) {
      const source = tab.picker.sources.find((s) => s.id === sourceId);
      if (source) return source.name;
    }
  }
  return null;
}

export function toBoardName(
  config: NoticeTabsConfig | undefined,
  { sourceId, department }: { sourceId: string; department: string | null },
): string | null {
  return toSourceName(config, sourceId) ?? department;
}
