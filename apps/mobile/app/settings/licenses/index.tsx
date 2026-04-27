import { Stack } from 'expo-router';
import { useT } from '@skkuverse/shared';
import { LicensesScreen } from '@/features/settings/LicensesScreen';

export default function LicensesRoute() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.licenses') }} />
      <LicensesScreen />
    </>
  );
}
