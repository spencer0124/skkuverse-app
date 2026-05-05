import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { defaultHeaderOptions } from '@/lib/header-options';
import { NoticesHeader } from '@/features/notices/components/NoticesHeader';

// `header: () => Component` set via inline `<Stack.Screen>` JSX inside the
// screen body (notices/index.tsx) was being silently ignored by native-stack
// — the callback was never invoked. Hoisting the option to the Stack layout
// here works. Other inline options (headerShown, title, headerRight) still
// work from the screen body, so the gate branch in notices/index.tsx can
// override `headerShown: false` when needed.
//
// `topInset` is captured here (inside SafeAreaProvider tree) and forwarded
// to NoticesHeader because the custom header callback mounts in the
// UINavigationBar host view, where useSafeAreaInsets() returns 0 and the
// strip would otherwise render under the status bar / Dynamic Island.
export default function NoticesTabStackLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Stack screenOptions={defaultHeaderOptions}>
      <Stack.Screen
        name="index"
        options={{
          header: () => <NoticesHeader topInset={insets.top} />,
        }}
      />
    </Stack>
  );
}
