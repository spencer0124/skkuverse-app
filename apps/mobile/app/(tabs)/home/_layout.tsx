import { Stack } from 'expo-router';
import { defaultHeaderOptions } from '@/lib/header-options';

export default function HomeStackLayout() {
  return <Stack screenOptions={defaultHeaderOptions} />;
}
