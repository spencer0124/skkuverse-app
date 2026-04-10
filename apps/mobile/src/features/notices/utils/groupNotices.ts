import type { NoticeListItem, AppLanguage } from '@skkuverse/shared';
import { t } from '@skkuverse/shared';

export type NoticeSectionKey = 'today' | 'thisWeek' | 'thisMonth' | 'earlier';

export interface NoticeSection {
  key: NoticeSectionKey;
  title: string;
  data: NoticeListItem[];
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Monday-start week. Returns ms timestamp of this week's Monday 00:00 (local). */
function startOfThisWeek(now: Date): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // JS getDay: 0=Sun, 1=Mon, ..., 6=Sat
  const dow = d.getDay();
  const daysFromMonday = (dow + 6) % 7; // Mon=0, Sun=6
  d.setDate(d.getDate() - daysFromMonday);
  return d.getTime();
}

function startOfThisMonth(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function sectionKeyFor(
  iso: string,
  todayStart: number,
  weekStart: number,
  monthStart: number,
): NoticeSectionKey {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'earlier';
  const itemStart = startOfLocalDay(parsed);
  if (itemStart >= todayStart) return 'today';
  if (itemStart >= weekStart) return 'thisWeek';
  if (itemStart >= monthStart) return 'thisMonth';
  return 'earlier';
}

const SECTION_ORDER: NoticeSectionKey[] = [
  'today',
  'thisWeek',
  'thisMonth',
  'earlier',
];

export function groupNoticesByDate(
  items: NoticeListItem[],
  lang: AppLanguage,
): NoticeSection[] {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const weekStart = startOfThisWeek(now);
  const monthStart = startOfThisMonth(now);

  const buckets: Record<NoticeSectionKey, NoticeListItem[]> = {
    today: [],
    thisWeek: [],
    thisMonth: [],
    earlier: [],
  };
  for (const item of items) {
    buckets[sectionKeyFor(item.date, todayStart, weekStart, monthStart)].push(
      item,
    );
  }

  const labels: Record<NoticeSectionKey, string> = {
    today: t(lang, 'notices.sectionToday'),
    thisWeek: t(lang, 'notices.sectionThisWeek'),
    thisMonth: t(lang, 'notices.sectionThisMonth'),
    earlier: t(lang, 'notices.sectionEarlier'),
  };

  return SECTION_ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
    key: k,
    title: labels[k],
    data: buckets[k],
  }));
}
