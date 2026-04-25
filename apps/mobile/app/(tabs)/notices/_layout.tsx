import { Stack } from 'expo-router';
import { defaultHeaderOptions } from '@/lib/header-options';

export default function NoticesTabStackLayout() {
  return <Stack screenOptions={defaultHeaderOptions} />;
}
