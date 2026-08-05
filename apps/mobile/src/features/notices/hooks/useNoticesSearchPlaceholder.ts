import { useT, useNoticeTabs, type TranslationKey } from '@skkuverse/shared';
import { useNoticesUiStore } from '../store/noticesUiStore';

/**
 * Placeholder rotation pool. Every entry takes the active tab label as `{0}`;
 * `tpl` leaves entries without a placeholder untouched, so they can all go
 * through one call path.
 *
 * All three are question-shaped. The old "{탭} 공지 검색" anchor was dropped
 * when the screen behind this stopped being a keyword filter — the composer is
 * a question box now, and a placeholder that says "검색" teaches the wrong
 * input.
 *
 * Why a pool at all: the input's placeholder is the only onboarding surface
 * that reliably lands. Users reach search from the pill, never from a
 * first-run tour, so a dedicated "you can ask questions now" screen would go
 * unseen (NN/g observed exactly this with Google's AI Mode — participants
 * entered from the browser bar, skipped onboarding, and kept typing keywords).
 * Rotating the hint teaches natural-language search in the one place they
 * actually look.
 */
const HINT_POOL: TranslationKey[] = [
  'notices.search.hint.ask',
  'notices.search.hint.natural',
  'notices.search.hint.anything',
];

/**
 * Rolled once per app session at module init, not per render or per mount.
 *
 * Per-render would flicker while the list scrolls under the accessory bar;
 * per-mount would make the pill and the search screen disagree mid-navigation.
 * Session-stable means the user sees one hint per launch and a different one
 * next time — enough rotation to teach, none of the churn.
 */
const SESSION_HINT_INDEX = Math.floor(Math.random() * HINT_POOL.length);

/**
 * Notices 검색 입구의 placeholder 문자열 — 세 표면 (iOS 26 accessory bar,
 * iOS<26/Android fallback capsule, 검색 화면 입력창) 의 SSOT.
 *
 * 활성 탭 라벨이 아직 안 풀린 상태 (cold start, tabsConfig 로딩 중,
 * activeTabKey 미설정) 에선 prefix 없는 fallback "공지 검색" 을 반환해
 * 선행 공백 (" 공지 검색") 을 회피 — 동시에, 라벨이 풀리기 전에 로테이션
 * 항목을 보여줬다가 풀린 뒤 다른 항목으로 바뀌는 깜빡임도 막는다.
 */
export function useNoticesSearchPlaceholder(): string {
  const { t, tpl } = useT();
  const activeTabKey = useNoticesUiStore((s) => s.activeTabKey);
  const { data: tabsConfig } = useNoticeTabs();

  const activeLabel =
    tabsConfig?.tabs.find((tab) => tab.key === activeTabKey)?.label ?? '';

  if (!activeLabel) return t('notices.accessory.searchPlaceholder');
  return tpl(HINT_POOL[SESSION_HINT_INDEX], activeLabel);
}
