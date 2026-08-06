import type { NoticePeriod } from '@skkuverse/shared';
import {
  formatHourMinute,
  parseLocalDate,
  startOfLocalDay,
  toEffectiveDateTime,
} from './localDate';

/**
 * 상세 화면 일정 타임라인 빌더.
 *
 * 기존 `SummaryCard`는 `periods`(날짜)와 `details`(대상/주최 같은 속성)를
 * `{label, value}` 한 배열로 평탄화해 11행짜리 단일 표로 그렸다. 그러면
 * "성적 공시 26.12.24"와 "주최 글로벌융합학부"가 같은 무게로 나란히 서서
 * 어디를 봐야 할지가 사라진다. 여기서는 날짜형만 떼어내 **시간축 위의 상태**
 * (지남/진행중/예정)를 부여하고, 가장 임박한 마감 한 줄을 강조 대상으로 표시한다.
 */

export type TimelineStatus = 'past' | 'current' | 'future';

export interface TimelineEntry {
  /** 서버가 준 구분자("1차 납부"). 단일 기간이면 null. */
  label: string | null;
  /** "8.3 ~ 8.7" / "~8.24" / "8.31~" 같은 사람이 읽는 범위 문자열. */
  range: string;
  status: TimelineStatus;
  /**
   * 헤드라인 D-day가 가리키는 바로 그 단계인지.
   *
   * '진행중(current)'과는 다른 축이다 — 아직 시작 안 한 단계도 가장 임박한
   * 마감이면 여기가 true가 된다. 히어로의 "D-2"와 타임라인의 한 줄이 같은
   * 색으로 묶여야 둘이 별개 블록으로 읽히지 않는다.
   */
  isHighlighted: boolean;
}

export interface NoticeTimeline {
  entries: TimelineEntry[];
}

// ── 날짜 표기 ──

/**
 * 올해 날짜면 연도를 뗀다("8.7"), 아니면 붙인다("25.8.7").
 *
 * 연도를 무조건 빼면 작년/내년 공지에서 거짓말이 되고, 무조건 붙이면
 * 화면 대부분을 차지하는 "26."이 여섯 줄 반복되며 정작 중요한 월·일을
 * 가린다. 기준은 렌더 시점의 로컬 연도.
 */
function formatDatePart(date: string, currentYear: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const md = `${m}.${d}`;
  return y === currentYear ? md : `${String(y).slice(2)}.${md}`;
}

function withTime(datePart: string, time: string | null): string {
  return time ? `${datePart} ${formatHourMinute(time)}` : datePart;
}

/**
 * 한 기간을 범위 문자열로. 표현 가능한 날짜가 하나도 없으면 null
 * (호출부가 그 엔트리를 통째로 버린다).
 */
export function formatPeriodRange(
  period: NoticePeriod,
  currentYear: number,
): string | null {
  const { startDate, startTime, endDate, endTime } = period;
  if (!startDate && !endDate) return null;

  if (startDate && endDate) {
    // 같은 날 = 기간이 아니라 시점. "8.7 ~ 8.7"은 정보가 아니라 소음이다.
    if (startDate === endDate) {
      const day = formatDatePart(startDate, currentYear);
      if (startTime && endTime) {
        return `${day} ${formatHourMinute(startTime)} ~ ${formatHourMinute(endTime)}`;
      }
      return withTime(day, startTime);
    }
    return `${withTime(formatDatePart(startDate, currentYear), startTime)} ~ ${withTime(
      formatDatePart(endDate, currentYear),
      endTime,
    )}`;
  }

  // 물결표는 앱 전반(기존 formatPeriod 포함)의 기간 표기라 그대로 따른다.
  // 열린 쪽에 공백을 두지 않으면("8.31~") 끊긴 게 아니라 이어진다는 게 읽힌다.
  if (endDate) return `~${withTime(formatDatePart(endDate, currentYear), endTime)}`;
  return `${withTime(formatDatePart(startDate!, currentYear), startTime)}~`;
}

// ── 상태 판정 ──

function resolveStatus(period: NoticePeriod, now: Date): TimelineStatus {
  const todayStart = startOfLocalDay(now);
  const { startDate, endDate, endTime } = period;

  // 끝이 정해진 기간: 끝이 지났으면 past.
  if (endDate) {
    const endDT = toEffectiveDateTime(endDate, endTime);
    if (endDT.getTime() < now.getTime()) return 'past';
    // 아직 안 끝났다. 시작일을 모르면("~8.24" 형태) current라고 단정하지
    // 않는다 — '진행중'은 "지금 이걸 할 수 있다"는 강한 주장이고, 시작일
    // 없이는 근거가 없다. 실제로 그렇게 판정했더니 8/1 기준 타임라인이
    // `○ ○ ▶ ○ ○ ○`으로 나와, 아직 시작도 안 한 신청(8.3~)을 건너뛰고
    // 수강신청만 진행중으로 보이는 상태가 됐다.
    if (!startDate) return 'future';
    return startOfLocalDay(parseLocalDate(startDate)) <= todayStart
      ? 'current'
      : 'future';
  }

  // 끝이 열린 기간("8.31 –"): 시작 전이면 future, 시작했으면 current.
  // past는 될 수 없다 — 끝난다는 정보가 없으므로.
  if (startDate) {
    return startOfLocalDay(parseLocalDate(startDate)) <= todayStart
      ? 'current'
      : 'future';
  }

  return 'future';
}

// ── 강조 대상 ──

/**
 * 아직 안 지난 마감 중 **가장 이른 것**의 인덱스. 없으면 -1.
 *
 * 시작일이 아니라 종료일을 기준으로 고르는 이유: 사용자가 놓치면 손해인 건
 * "언제 시작하나"가 아니라 "언제까지 해야 하나"다. 종료일이 없는(열린) 기간은
 * 놓칠 마감 자체가 없으므로 후보에서 제외한다.
 *
 * 한때 여기서 D-day 헤드라인(`D-22 · 지원 마감`)까지 만들었지만, 바로 아래
 * 타임라인이 같은 사실을 이미 보여 주고 있어 헤드라인은 제거했다. 남은 역할은
 * "어느 줄을 강조할지" 하나뿐이라 인덱스만 돌려준다.
 */
function findNearestDeadlineIndex(periods: NoticePeriod[], now: Date): number {
  let bestIndex = -1;
  let bestTime = Infinity;

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (!p.endDate) continue;
    const endMs = toEffectiveDateTime(p.endDate, p.endTime).getTime();
    if (endMs < now.getTime()) continue;
    if (endMs < bestTime) {
      bestTime = endMs;
      bestIndex = i;
    }
  }

  return bestIndex;
}

// ── public ──

export function buildNoticeTimeline(
  periods: NoticePeriod[],
  now: Date = new Date(),
): NoticeTimeline {
  const currentYear = now.getFullYear();

  // 서버가 준 순서를 그대로 쓴다 — 날짜순으로 재정렬하지 않는다.
  // periods는 공지 본문 등장 순서(= 사실상 절차 순서)로 오고, 같은 날짜를
  // 공유하는 다단계 항목("1차 납부"/"2차 납부")에서 날짜 정렬은 의미 있는
  // 순서를 오히려 흐트러뜨린다.
  const nearestIndex = findNearestDeadlineIndex(periods, now);

  const entries: TimelineEntry[] = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const range = formatPeriodRange(p, currentYear);
    // 날짜가 하나도 없는 period는 타임라인에서 빠진다. 그래서 entries의
    // 인덱스는 periods의 인덱스와 어긋날 수 있어, 강조 대상은
    // **원본 periods 인덱스**로 비교해야 한다.
    if (!range) continue;
    entries.push({
      label: p.label,
      range,
      status: resolveStatus(p, now),
      isHighlighted: i === nearestIndex,
    });
  }

  return { entries };
}
