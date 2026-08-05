/**
 * 공지 날짜 계산 공용 헬퍼.
 *
 * `formatDeadlineBadge`(리스트 셀 배지)와 `buildNoticeTimeline`(상세 타임라인)이
 * 같은 규칙으로 "오늘"을 판정해야 해서 한곳에 모았다. 두 곳에 복제해 두면
 * 타임존 처리가 조용히 갈라진다 — 리스트에선 D-1인데 상세에선 D-0으로 보이는
 * 식의 버그는 재현도 어렵다.
 *
 * 모든 함수는 **기기 로컬 타임존** 기준이다(단말에선 사실상 KST).
 */

/** 그 날 00:00:00의 epoch ms. */
export function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * "YYYY-MM-DD" → 로컬 00:00의 Date.
 *
 * `new Date('YYYY-MM-DD')`를 쓰지 않는 이유: 그 형식은 스펙상 **UTC**로 파싱돼
 * KST(+9)에선 하루 전으로 밀린다. 날짜만 있는 값에 이걸 쓰면 D-day가 통째로
 * 하루 틀어진다.
 */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * date + optional time → 로컬 Date. time이 없으면 그 날 23:59:59.999로 본다
 * (— "8월 7일까지"는 7일이 끝날 때까지라는 뜻이지 7일 0시가 아니다).
 */
export function toEffectiveDateTime(date: string, time: string | null): Date {
  const base = parseLocalDate(date);
  if (!time) {
    base.setHours(23, 59, 59, 999);
    return base;
  }
  const parts = time.split(':').map(Number);
  const hh = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  const ss = parts[2] ?? 0;
  base.setHours(hh, mm, ss, 0);
  return base;
}

/** 두 '자정 epoch ms' 사이의 일수. 인자는 startOfLocalDay 결과여야 한다. */
export function diffDays(fromStartMs: number, toStartMs: number): number {
  return Math.round((toStartMs - fromStartMs) / 86_400_000);
}

/** "HH:mm[:ss]" → "H:mm" (24h, 분은 두 자리 유지) */
export function formatHourMinute(time: string): string {
  const parts = time.split(':');
  const hh = Number(parts[0] ?? 0);
  const mm = parts[1] ?? '00';
  return `${hh}:${mm.padStart(2, '0')}`;
}
