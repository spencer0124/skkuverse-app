import { useRouter } from 'expo-router';
import { useAuthStore, useT } from '@skkuverse/shared';
import { NoticesTabScreen } from '@/features/notices/NoticesTabScreen';
import { NoticeLoginGate } from '@/features/notices/components/NoticeLoginGate';

export default function NoticesTab() {
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const router = useRouter();
  const { t } = useT();

  if (isAnonymous) {
    return (
      <NoticeLoginGate
        description={t('notices.loginRequired')}
        onLoginPress={() => router.push('/login')}
      />
    );
  }

  return <NoticesTabScreen />;
}
