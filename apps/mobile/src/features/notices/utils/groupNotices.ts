import type { NoticeListItem, AppLanguage } from '@skkuverse/shared';
import { tpl } from '@skkuverse/shared';

export interface NoticeSection {
  key: string;
  title: string;
  data: NoticeListItem[];
}

const DAY_MS = 86_400_000;

/** English month names for en locale section headers. */
const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function sectionKeyFor(itemDate: string, todayStart: number, thisYear: number): string {
  const parts = itemDate.split('-').map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return 'year-0';
  const [y, m, d] = parts;
  const itemStart = new Date(y, m - 1, d).getTime();
  const days = Math.floor((todayStart - itemStart) / DAY_MS);

  if (days < 7) return 'recent7';
  if (days < 30) return 'recent30';
  if (y === thisYear) return `month-${m - 1}`; // 0-indexed month
  return `year-${y}`;
}

function sectionLabel(key: string, lang: AppLanguage): string {
  if (key === 'recent7') return tpl(lang, 'notices.sectionRecent7');
  if (key === 'recent30') return tpl(lang, 'notices.sectionRecent30');

  if (key.startsWith('month-')) {
    const monthIdx = parseInt(key.slice(6), 10);
    if (lang === 'en') return EN_MONTHS[monthIdx] ?? '';
    return tpl(lang, 'notices.sectionMonth', monthIdx + 1);
  }

  if (key.startsWith('year-')) {
    const year = parseInt(key.slice(5), 10);
    return tpl(lang, 'notices.sectionYear', year);
  }

  return key;
}

/** Sort priority: recent7 → recent30 → month (desc) → year (desc). */
function sectionSortOrder(key: string): number {
  if (key === 'recent7') return 0;
  if (key === 'recent30') return 1;
  if (key.startsWith('month-')) {
    const m = parseInt(key.slice(6), 10);
    return 100 + (11 - m); // higher month first (desc)
  }
  if (key.startsWith('year-')) {
    const y = parseInt(key.slice(5), 10);
    return 1000 + (9999 - y); // higher year first (desc)
  }
  return 99999;
}

export function groupNoticesByDate(
  items: NoticeListItem[],
  lang: AppLanguage,
): NoticeSection[] {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const thisYear = now.getFullYear();

  const buckets = new Map<string, NoticeListItem[]>();

  for (const item of items) {
    const key = sectionKeyFor(item.date, todayStart, thisYear);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(item);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => sectionSortOrder(a[0]) - sectionSortOrder(b[0]))
    .map(([key, data]) => ({
      key,
      title: sectionLabel(key, lang),
      data,
    }));
}
