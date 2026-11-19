import { useMemo } from 'react';
import { useT } from '@skkuverse/shared';
import { useNoticeDetail } from './useNoticeDetail';
import { useNoticeTabs } from './useNoticeTabs';
import { toBoardName } from './notices.rules';
import { extractContentRefs } from './content-refs.rules';
import { toNoticeBrief } from './notice-brief.rules';
import { dummyNoticeBrief } from './notices.client';

export function useNoticeBrief(sourceId: string, articleNo: number) {
  const { t } = useT();
  const dummy = useMemo(() => dummyNoticeBrief(sourceId, articleNo), [sourceId, articleNo]);
  const query = useNoticeDetail(dummy ? null : sourceId, dummy ? null : articleNo);
  const { data: tabsConfig } = useNoticeTabs();
  const { data } = query;

  const brief = useMemo(() => {
    if (dummy) return dummy;
    if (!data) return undefined;
    return toNoticeBrief({
      notice: data,
      boardName: toBoardName(tabsConfig, data),
      refs: extractContentRefs(data.contentMarkdown, data.attachments.map((a) => a.url)),
      question: t('notices.brief.defaultQuestion'),
    });
  }, [dummy, data, tabsConfig, t]);

  return { ...query, brief };
}
