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
  | 'normal' // 회색: action_required D≥4, event D-n
  | 'closed' // 회색: 지난 action_required
  | 'eventToday' // 파랑: event 당일
  | 'inProgress' // 초록: informational 진행 중
  | 'upcoming'; // 연한 회색: informational 시작 전

export interface DeadlinePill {
  text: string;
  variant: DeadlineVariant;
}

export interface DeadlineInfo {
  /** Compact, colored pill — short status like "D-13" / "마감" / "진행 중 ~5/1". */
  pill: DeadlinePill;
  /**
   * Extra context displayed next to the pill as " · {context}", e.g.
   * "1차 신청". Only populated for `action_required` with an `endAt.label`;
   * null otherwise.
   */
  context: string | null;
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
): DeadlineInfo | null {
  if (!endAt?.date) return null;

  const endDT = toEffectiveDateTime(endAt.date, endAt.time);
  const todayStart = startOfLocalDay(now);
  const endStart = startOfLocalDay(parseLocalDate(endAt.date));
  const d = diffDays(todayStart, endStart);

  const label = endAt.label || null;
  const isPast = endDT.getTime() < now.getTime();

  let pill: DeadlinePill;

  if (isPast) {
    pill = { text: '마감', variant: 'closed' };
  } else if (d === 0 && endAt.time) {
    pill = {
      text: `오늘 ${formatHourMinute(endAt.time)}`,
      variant: 'urgent',
    };
  } else if (d === 0) {
    pill = { text: 'D-0', variant: 'urgent' };
  } else if (d <= 3) {
    pill = { text: `D-${d}`, variant: 'urgent' };
  } else {
    pill = { text: `D-${d}`, variant: 'normal' };
  }

  // For future deadlines with a label, append "까지" (natural Korean:
  // "D-33 · 1차 신청까지"). For closed action_required, drop the label
  // entirely — ordinal labels like "2차 신청" read ambiguously next to
  // "마감" (is round 2 closed, or is it next?), and even appositive
  // labels add little value once the deadline has passed. The full
  // label is still visible in the detail screen's SummaryCard.
  const context = label && !isPast ? `${label}까지` : null;

  return { pill, context };
}

function eventBadge(
  startAt: NoticeStartAt | null,
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineInfo | null {
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

  let pill: DeadlinePill;
  if (d === 0 && anchorTime) {
    pill = {
      text: `오늘 ${formatHourMinute(anchorTime)}`,
      variant: 'eventToday',
    };
  } else if (d === 0) {
    pill = { text: '오늘', variant: 'eventToday' };
  } else {
    pill = { text: `D-${d}`, variant: 'normal' };
  }
  return { pill, context: null };
}

function informationalBadge(
  startAt: NoticeStartAt | null,
  endAt: NoticeEndAt | null,
  now: Date,
): DeadlineInfo | null {
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
    return {
      pill: { text: `D-${d}`, variant: 'upcoming' },
      context: '시작까지',
    };
  }
  if (todayStart <= endStart) {
    return {
      pill: {
        text: `진행 중 ~${formatMonthDay(end)}`,
        variant: 'inProgress',
      },
      context: null,
    };
  }
  return null;
}

// ── public API ──

export function formatDeadlineBadge(
  summary: NoticeListItemSummary | null,
  now: Date = new Date(),
): DeadlineInfo | null {
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
// Assuming now = 2026-04-11. Shape is { pill: {text, variant}, context }.
// NoticeRow renders `${pill.text} · ${context}` inside a single colored box
// when context exists, else just `pill.text`. For action_required with a
// label, "까지" is baked into `context` for future deadlines (past → just
// the label).
//
// - 통금해제 4/13~4/26 informational        → pill="D-2" (upcoming), context="시작까지"
//     → "D-2 · 시작까지"
// - 시험기간 4/20~5/01 informational         → pill="D-9 시작" (upcoming), context=null
//   at 4/20                                    → pill="진행 중 ~5/1" (inProgress), context=null
// - Peter Singer 토크콘서트 4/15 19:00 event  → pill="D-4" (normal), context=null
//   on 4/15                                    → pill="오늘 19:00" (eventToday), context=null
// - 기아 채용 action_required (label 없음)      → pill="D-N", context=null
//     → "D-N"
// - 복수전공 label="1차 신청"                   → pill="D-2" (urgent), context="1차 신청까지"
//     → "D-2 · 1차 신청까지"
// - 지난 action_required with label="1차 신청" → pill="마감" (closed), context=null
//     → "마감" (label dropped to avoid ambiguous "마감 · 2차 신청"-style reads)
// - action_required D-0 + time 17:00, no label → pill="오늘 17:00", context=null
//     → "오늘 17:00"
// - action_required D-0 + time 17:00 + label   → pill="오늘 17:00", context="label까지"
//     → "오늘 17:00 · label까지"
// - 서초 방역 4/09 14:00~17:00 informational (start===end) → null
