// CONTRACT(skkuverse-server): the `row` of skkuverse-server/contracts/produced/notices-list.noticeList.schema.json;
// every string is finished server text (skkuverse/docs/decisions/0009-notice-list-rows.md).
export const NOTICE_LIST_ROW_TONES = [
  'urgent',
  'today',
  'cancelled',
  'closed',
  'stopped',
  'postponed',
  'extended',
  'changed',
] as const;
export type NoticeListRowTone = (typeof NOTICE_LIST_ROW_TONES)[number];

export const NOTICE_LIST_ROW_DAYS = ['today', 'yesterday', 'thisWeek', 'earlier'] as const;
export type NoticeListRowDay = (typeof NOTICE_LIST_ROW_DAYS)[number];

export const NOTICE_LIST_ROW_DATE_MARKS = ['warning', 'abstain'] as const;
export type NoticeListRowDateMark = (typeof NOTICE_LIST_ROW_DATE_MARKS)[number];

export interface NoticeListRowToken {
  text: string;
  /** WHY: null for a tone this build does not know; its text still shows, in neutral ink. */
  tone: NoticeListRowTone | null;
}

export interface NoticeListRow {
  token: NoticeListRowToken | null;
  title: string;
  when: string | null;
  isUrgent: boolean;
  dateMark: NoticeListRowDateMark | null;
  qualifier: string | null;
  board: string | null;
  isDimmed: boolean;
  day: NoticeListRowDay | null;
}
