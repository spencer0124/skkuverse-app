import type { NoticeAudience, NoticeAudienceLevel, NoticeAudienceStatus } from './notice-audience.types';

export type NoticeAudienceRow =
  | { kind: 'level'; codes: NoticeAudienceLevel[] }
  | { kind: 'status'; codes: NoticeAudienceStatus[] }
  | { kind: 'excludedStatus'; codes: NoticeAudienceStatus[] };

export function toNoticeAudienceRows(audience: NoticeAudience): NoticeAudienceRow[] {
  const rows: NoticeAudienceRow[] = [
    { kind: 'level', codes: audience.level.include },
    { kind: 'status', codes: audience.status.include },
    { kind: 'excludedStatus', codes: audience.status.exclude },
  ];
  return rows.filter((row) => row.codes.length > 0);
}

export function hasNoticeAudience(audience: NoticeAudience): boolean {
  return toNoticeAudienceRows(audience).length > 0;
}
