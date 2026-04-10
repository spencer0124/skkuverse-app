import { useLocalSearchParams } from 'expo-router';
import { NoticeDetailScreen } from '@/features/notices/NoticeDetailScreen';

export default function NoticeDetailRoute() {
  const { deptId, articleNo } = useLocalSearchParams<{
    deptId: string;
    articleNo: string;
  }>();
  if (!deptId || !articleNo) return null;
  const num = Number(articleNo);
  if (!Number.isFinite(num)) return null;
  return <NoticeDetailScreen deptId={deptId} articleNo={num} />;
}
