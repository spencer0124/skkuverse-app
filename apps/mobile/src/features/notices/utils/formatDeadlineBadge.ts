import type {
  NoticeEndAt,
  NoticeListItemSummary,
  NoticeStartAt,
} from '@skkuverse/shared';

/**
 * Format a notice summary into a badge for the list cell. Branches by
 * `summaryType` so that action_required, event, and informational notices
 * each get the right visual meaning.
 *
 * Day difference is computed against the *start of today* in the device's
 * local timezone (on-device that's KST).
 */
export type DeadlineVariant =
  | 'urgent' // 빨강: action_required D≤3, D-0 오늘
  | 'soon' // 주황: action_required D 4~7
  | 'normal' // 회색: action_required D>7, event D-n
  | 'closed' // 회색: 지난 action_required
  | 'eventToday' // 파랑: event 당일
  | 'inProgress' // 초록: informational 진행 중
  | 'upcoming'; // 연한 회색: informational 시작 전

export interface DeadlineBadge {
  text: string;
  variant: DeadlineVariant;
}

// ── helpers ──

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// "YYYY-MM-DD" → Date at local 00:00. Safer than `new Date('YYYY-MM-DD')`,
// which parses as UTC and can shift day in non-UTC zones.
function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// date + optional time → local Date. If time is null, falls back to 23:59:59.
function toEffectiveDateTime(date: string, time: string | null): Date {
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

function diffDays(fromStartMs: number, toStartMs: number): number {
  return Math.round((toStartMs - fromStartMs) / 86_400_000);
}

// "HH:mm[:ss]" → "H:mm" (24h, keep leading zero on minutes)
function formatHourMinute(time: string): string {
  const parts = time.split(':');
  const hh = Number(parts[0] ?? 0);
  const mm = parts[1] ?? '00';
  return `${hh}:${mm.padStart(2, '0')}`;
}

// "YYYY-MM-DD" → "M/D" (no leading zeros)
function formatMonthDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

// ── per-type handlers ──

function actionRequiredBadge(
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineBadge | null {
  if (!endAt?.date) return null;

  const endDT = toEffectiveDateTime(endAt.date, endAt.time);
  const todayStart = startOfLocalDay(now);
  const endStart = startOfLocalDay(parseLocalDate(endAt.date));
  const d = diffDays(todayStart, endStart);

  let core: DeadlineBadge;

  if (endDT.getTime() < now.getTime()) {
    core = { text: '마감', variant: 'closed' };
  } else if (d === 0 && endAt.time) {
    core = { text: `오늘 ${formatHourMinute(endAt.time)}`, variant: 'urgent' };
  } else if (d === 0) {
    core = { text: 'D-0', variant: 'urgent' };
  } else if (d <= 3) {
    core = { text: `D-${d}`, variant: 'urgent' };
  } else if (d <= 7) {
    core = { text: `D-${d}`, variant: 'soon' };
  } else {
    core = { text: `D-${d}`, variant: 'normal' };
  }

  if (endAt.label) {
    core = { ...core, text: `${endAt.label} ${core.text}` };
  }
  return core;
}

function eventBadge(
  startAt: NoticeStartAt | null,
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineBadge | null {
  const anchorDate = endAt?.date ?? startAt?.date ?? null;
  const anchorTime = endAt?.time ?? startAt?.time ?? null;
  if (!anchorDate) return null;

  const anchorDT = toEffectiveDateTime(anchorDate, anchorTime);
  // 지난 이벤트는 배지 숨김
  if (anchorDT.getTime() < now.getTime()) return null;

  const d = diffDays(
    startOfLocalDay(now),
    startOfLocalDay(parseLocalDate(anchorDate)),
  );

  if (d === 0 && anchorTime) {
    return {
      text: `오늘 ${formatHourMinute(anchorTime)}`,
      variant: 'eventToday',
    };
  }
  if (d === 0) return { text: '오늘', variant: 'eventToday' };
  return { text: `D-${d}`, variant: 'normal' };
}

function informationalBadge(
  startAt: NoticeStartAt | null,
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineBadge | null {
  const start = startAt?.date ?? null;
  const end = endAt?.date ?? null;

  // 단일 날짜/시작만/끝만/아무 것도 없음 → 배지 생략 (상세 화면에서 커버)
  if (!start || !end) return null;
  // 당일 단일 이벤트(서초 방역 4/09 14:00~17:00 등) → 리스트에선 배지 생략
  if (start === end) return null;

  const todayStart = startOfLocalDay(now);
  const startStart = startOfLocalDay(parseLocalDate(start));
  const endStart = startOfLocalDay(parseLocalDate(end));

  if (todayStart < startStart) {
    const d = diffDays(todayStart, startStart);
    return { text: `D-${d} 시작`, variant: 'upcoming' };
  }
  if (todayStart <= endStart) {
    return { text: `진행 중 ~${formatMonthDay(end)}`, variant: 'inProgress' };
  }
  return null;
}

// ── public API ──

export function formatDeadlineBadge(
  summary: NoticeListItemSummary | null,
  now: Date = new Date(),
): DeadlineBadge | null {
  if (!summary) return null;
  const { type, startAt, endAt } = summary;

  switch (type) {
    case 'action_required':
      return actionRequiredBadge(endAt, now);
    case 'event':
      return eventBadge(startAt, endAt, now);
    case 'informational':
      return informationalBadge(startAt, endAt, now);
  }
}

// ── manual test cases (reference only) ──
//
// Assuming now = 2026-04-11:
// - 통금해제 4/13~4/26 informational        → "D-2 시작" (upcoming)
// - 시험기간 4/20~5/01 informational         → "D-9 시작" (upcoming)
//   then at 4/20                              → "진행 중 ~5/1" (inProgress)
// - Peter Singer 토크콘서트 4/15 19:00 event  → "D-4" (normal)
//   on 4/15                                    → "오늘 19:00" (eventToday)
// - Elsevier action_required endAt=3/23       → server already best-picked; frontend uses endAt as-is
// - 기아 채용 action_required                  → server rolls 4/13 → 4/20 automatically
// - 복수전공 label="1차 신청"                   → "1차 신청 D-2" (urgent)
// - 서초 방역 4/09 14:00~17:00 informational (start===end) → 배지 없음
