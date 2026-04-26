import { Stack } from 'expo-router';
import { useT } from '@skkuverse/shared';
import { AccountSettingsScreen } from '@/features/settings/AccountSettingsScreen';

export default function AccountSettingsRoute() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('settings.account') }} />
      <AccountSettingsScreen />
    </>
  );
}
