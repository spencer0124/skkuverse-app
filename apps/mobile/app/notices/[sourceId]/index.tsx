import { useLocalSearchParams } from 'expo-router';
import { NoticeListScreen } from '@/features/notices/NoticeListScreen';

export default function SourceNoticeListRoute() {
  const { sourceId } = useLocalSearchParams<{ sourceId: string }>();
  if (!sourceId) return null;
  return <NoticeListScreen sourceId={sourceId} />;
}
