import { Stack } from 'expo-router';
import { useT } from '@skkuverse/shared';
import { AttributionsScreen } from '@/features/settings/AttributionsScreen';

export default function AttributionsRoute() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.attributions') }} />
      <AttributionsScreen />
    </>
  );
}
