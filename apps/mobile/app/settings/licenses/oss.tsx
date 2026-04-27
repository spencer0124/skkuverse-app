import { Stack } from 'expo-router';
import { useT } from '@skkuverse/shared';
import { OssLicensesScreen } from '@/features/settings/OssLicensesScreen';

export default function OssLicensesRoute() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.licensesOss') }} />
      <OssLicensesScreen />
    </>
  );
}
