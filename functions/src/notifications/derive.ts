import { logger } from 'firebase-functions/logger';
import { FIXED_TAB_KEYS, KNOWN_PICKER_KEYS } from './tabsContract.ts';
import type { CategoryEnabled } from '../types.ts';

/**
 * Pure function — Firestore read 없음, async 없음.
 * CF 트리거, 단위 테스트, REPL 어디서든 호출 가능.
 *
 * Defense in depth: 마스터 OFF (enabled=false)면 즉시 빈 배열 반환.
 * device 레벨 notificationsEnabled 필터에 의존하지 않고도 누수 차단.
 *
 * essential / services 카테고리는 현재 정의된 토픽 0개 (미래 확장용 빈 버킷).
 * 추후 'essential:emergency' / 'services:shuttle' 등 추가 시 분기 늘림.
 */
export function deriveSubscribedTopics(
  enabled: boolean,
  categoryEnabled: CategoryEnabled,
  pickerSelections: Record<string, string[]>,
  context?: { uid?: string },
): string[] {
  if (!enabled) return [];

  const topics = new Set<string>();

  if (categoryEnabled.notices) {
    // Fixed 탭: 모두 fan-out
    for (const key of FIXED_TAB_KEYS) {
      topics.add(`category:${key}`);
    }

    // Picker 탭: 사용자가 고른 id마다 토픽 한 개 (key === prefix identity)
    const known = new Set<string>(KNOWN_PICKER_KEYS);
    for (const [pickerKey, ids] of Object.entries(pickerSelections)) {
      if (!known.has(pickerKey)) {
        // Drift 조기 감지 — fail은 안 하고 Cloud Logging에 흔적.
        // 백엔드가 새 picker tab 추가했는데 CF tabsContract에 누락된 케이스.
        logger.warn('notifications.derive.unknown_picker_key', {
          uid: context?.uid,
          key: pickerKey,
          idCount: ids.length,
        });
        continue;
      }
      for (const id of ids) {
        topics.add(`${pickerKey}:${id}`);
      }
    }
  }

  // categoryEnabled.essential / categoryEnabled.services:
  //   현재 토픽 미정의 → 토글 ON이어도 추가 토픽 없음.
  //   미래: 분기 추가하여 'essential:emergency' 등 emit.

  return [...topics];
}
