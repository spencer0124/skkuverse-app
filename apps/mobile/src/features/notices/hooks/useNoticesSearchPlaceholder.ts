import { useT, useNoticeTabs } from '@skkuverse/shared';
import { useNoticesUiStore } from '../store/noticesUiStore';

/**
 * Notices 검색 입구의 placeholder 문자열 — 세 표면 (iOS 26 accessory bar,
 * iOS<26/Android fallback capsule, 검색 화면 입력창) 의 SSOT.
 *
 * 활성 탭 라벨이 아직 안 풀린 상태 (cold start, tabsConfig 로딩 중,
 * activeTabKey 미설정) 에선 prefix 없는 fallback "공지 검색" 을 반환해
 * 선행 공백 (" 공지 검색") 을 회피.
 */
export function useNoticesSearchPlaceholder(): string {
  const { t, tpl } = useT();
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const { data: tabsConfig } = useNoticeTabs();

  const activeLabel =
    tabsConfig?.tabs.find((tab) => tab.key === activeTabKey)?.label ?? '';

  if (!activeLabel) return t('notices.accessory.searchPlaceholder');
  return tpl('notices.search.placeholderWithTab', activeLabel);
}
