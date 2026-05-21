import { useLocalSearchParams } from 'expo-router';
import { NoticeDetailScreen } from '@/features/notices/NoticeDetailScreen';

export default function NoticeDetailRoute() {
  const { sourceId, articleNo, entrySource } = useLocalSearchParams<{
    sourceId: string;
    articleNo: string;
    // 'push' | 'universal_link' set by PendingNoticeLinkConsumer
    // (app/_layout.tsx). Undefined for in-app navigations — those never
    // route through the pending-link consumer.
    entrySource?: string;
  }>();
  if (!sourceId || !articleNo) return null;
  const num = Number(articleNo);
  if (!Number.isFinite(num)) return null;
  const normalizedSource =
    entrySource === 'push' || entrySource === 'universal_link'
      ? entrySource
      : undefined;
  return (
    <NoticeDetailScreen
      sourceId={sourceId}
      articleNo={num}
      entrySource={normalizedSource}
    />
  );
}
