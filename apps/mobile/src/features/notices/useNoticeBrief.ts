import { useMemo } from 'react';
import { useNoticeDetail } from './useNoticeDetail';
import { useNoticeTabs } from './useNoticeTabs';
import { toBoardName } from './notices.rules';
import { toNoticeBrief } from './notice-brief.rules';
import { dummyNoticeDetail } from './notices.client';

export function useNoticeBrief(sourceId: string, articleNo: number) {
  const dummy = useMemo(() => dummyNoticeDetail(sourceId, articleNo), [sourceId, articleNo]);
  const query = useNoticeDetail(dummy ? null : sourceId, dummy ? null : articleNo);
  const { data: tabsConfig } = useNoticeTabs();
  const notice = dummy ?? query.data;

  const brief = useMemo(
    () => (notice ? toNoticeBrief({ notice, boardName: toBoardName(tabsConfig, notice) }) : undefined),
    [notice, tabsConfig],
  );

  return { ...query, brief };
}
