import { useLocalSearchParams } from 'expo-router';
import { NoticeBodyScreen } from '@/features/notices/NoticeBodyScreen';

export default function NoticeBodyRoute() {
  const { sourceId, articleNo } = useLocalSearchParams<{ sourceId: string; articleNo: string }>();
  if (!sourceId || !articleNo) return null;
  const num = Number(articleNo);
  if (!Number.isFinite(num)) return null;
  return <NoticeBodyScreen sourceId={sourceId} articleNo={num} />;
}
