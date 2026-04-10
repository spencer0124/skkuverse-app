import { useLocalSearchParams } from 'expo-router';
import { NoticeListScreen } from '@/features/notices/NoticeListScreen';

export default function DeptNoticeListRoute() {
  const { deptId } = useLocalSearchParams<{ deptId: string }>();
  if (!deptId) return null;
  return <NoticeListScreen deptId={deptId} />;
}
