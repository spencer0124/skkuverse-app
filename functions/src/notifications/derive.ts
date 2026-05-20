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
 * 공지 탭 단위 미세 제어: noticeTabEnabled[key] 가 false인 탭만 제외.
 * undefined / true → 포함. 이 default-on 정책은 신규 server 탭이 자동으로
 * 기존 유저에게 켜지도록 함 (opt-out).
 *
 * essential / services 카테고리는 현재 정의된 토픽 0개 (미래 확장용 빈 버킷).
 * 추후 'essential:emergency' / 'services:shuttle' 등 추가 시 분기 늘림.
 */
export function deriveSubscribedTopics(
  enabled: boolean,
  categoryEnabled: CategoryEnabled,
  noticeTabEnabled: Record<string, boolean>,
  pickerSelections: Record<string, string[]>,
  context?: { uid?: string },
): string[] {
  if (!enabled) return [];

  // SSOT lock: essential 카테고리는 항상 ON. 클라가 false 를 보내도 (Rules 가
  // 차단하지만 defense-in-depth 차원에서) derive 는 essential 을 true 로 간주해야 함.
  // 미래에 'essential:emergency' 등 토픽 추가 시: `if (true /* essentialEffective */)`
  // 형태로 분기 추가. 현재 essential 토픽 0개라 functional impact 없으므로 변수 생략.

  const topics = new Set<string>();

  // undefined → ON, false → OFF, true → ON.
  const tabOn = (key: string): boolean => noticeTabEnabled[key] !== false;

  if (categoryEnabled.notices) {
    // Fixed 탭: noticeTabEnabled 게이트 통과 시만 fan-out
    for (const key of FIXED_TAB_KEYS) {
      if (tabOn(key)) {
        topics.add(`category:${key}`);
      }
    }

    // Picker 탭: 사용자가 고른 id마다 토픽 한 개 (key === prefix identity).
    // 탭 자체가 OFF이면 picker 선택값 있어도 emit 안 함.
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
      if (!tabOn(pickerKey)) continue;
      for (const id of ids) {
        // dept[0] === '' sentinel ('대표학과 스킵' marker) 등 falsy id는
        // topic 'dept:' 형식이 invalid라 v1 API에서 reject. 컨벤션 보존
        // 위해 storage엔 유지하지만 emit 단계에서 필터.
        if (!id) continue;
        topics.add(`${pickerKey}:${id}`);
      }
    }
  }

  // categoryEnabled.essential / categoryEnabled.services:
  //   현재 토픽 미정의 → 토글 ON이어도 추가 토픽 없음.
  //   미래: 분기 추가하여 'essential:emergency' 등 emit.

  return [...topics];
}
