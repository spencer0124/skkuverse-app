import { t, tpl, type AppLanguage } from '@skkuverse/shared';

/**
 * 공지 게시일을 현재 기준 상대 표기로 변환.
 *
 * 입력은 "YYYY-MM-DD" 문자열(시간 정보 없음 — 로컬 자정 기준).
 * 오늘 항목은 `null`을 반환해 섹션 헤더("오늘")와 중복되는 표시를 피한다.
 *
 * 버킷:
 *   0일      → null
 *   1일      → "어제"
 *   2~6일    → "N일 전"
 *   7~29일   → "N주 전"    (Math.floor(days / 7))
 *   30~364일 → "N개월 전"  (Math.floor(days / 30))
 *   ≥ 365일  → "N년 전"    (Math.floor(days / 365))
 *
 * 미래 날짜는 `null`(리스트에 의미 없음).
 */
export function formatRelativeDate(
  date: string,
  lang: AppLanguage,
  now: Date = new Date(),
): string | null {
  // `new Date('YYYY-MM-DD')`는 UTC로 파싱돼 KST에선 하루 당겨질 수 있음.
  // formatDeadlineBadge와 동일한 방어 — 로컬 자정으로 파싱.
  const parts = date.split('-').map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  const itemStart = new Date(y, m - 1, d).getTime();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const days = Math.round((todayStart - itemStart) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return t(lang, 'notices.sectionToday');
  if (days === 1) return tpl(lang, 'notices.relativeYesterday');
  if (days < 7) return tpl(lang, 'notices.relativeDaysAgo', days);
  if (days < 30) {
    return tpl(lang, 'notices.relativeWeeksAgo', Math.floor(days / 7));
  }
  if (days < 365) {
    return tpl(lang, 'notices.relativeMonthsAgo', Math.floor(days / 30));
  }
  return tpl(lang, 'notices.relativeYearsAgo', Math.floor(days / 365));
}
