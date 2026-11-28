import { useCallback, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { useT } from '@skkuverse/shared';
import { useNoticeBrief } from './useNoticeBrief';
import { toFullBodyMarkdown } from './notice-brief.rules';

export function useNoticeBodyScreen(sourceId: string, articleNo: number) {
  const { t } = useT();
  const { brief, isLoading, refetch } = useNoticeBrief(sourceId, articleNo);
  const [toastText, setToastText] = useState<string | null>(null);
  const markdown = useMemo(() => (brief ? toFullBodyMarkdown(brief.body) : null), [brief]);
  const sourceUrl = brief?.source.url ?? null;

  const onCopy = useCallback(
    (text: string) => {
      void Clipboard.setStringAsync(text);
      setToastText(t('notices.copied'));
    },
    [t],
  );

  return {
    status: brief ? ('ready' as const) : isLoading ? ('loading' as const) : ('error' as const),
    markdown,
    sourceUrl,
    toastText,
    onCopy,
    onRetry: refetch,
    onToastClose: () => setToastText(null),
  };
}
