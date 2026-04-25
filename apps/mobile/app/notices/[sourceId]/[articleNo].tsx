import { useLocalSearchParams } from 'expo-router';
import { NoticeDetailScreen } from '@/features/notices/NoticeDetailScreen';

export default function NoticeDetailRoute() {
  const { sourceId, articleNo } = useLocalSearchParams<{
    sourceId: string;
    articleNo: string;
  }>();
  if (!sourceId || !articleNo) return null;
  const num = Number(articleNo);
  if (!Number.isFinite(num)) return null;
  return <NoticeDetailScreen sourceId={sourceId} articleNo={num} />;
}
