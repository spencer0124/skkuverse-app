import type { AUDIENCE_LEVELS, AUDIENCE_STATUSES } from './notice-audience.constants';

export type NoticeAudienceLevel = (typeof AUDIENCE_LEVELS)[number];
export type NoticeAudienceStatus = (typeof AUDIENCE_STATUSES)[number];

/** WHY: plain information shown as a table; nothing is filtered by it. */
export interface NoticeAudience {
  level: { include: NoticeAudienceLevel[] };
  status: { include: NoticeAudienceStatus[]; exclude: NoticeAudienceStatus[] };
}
