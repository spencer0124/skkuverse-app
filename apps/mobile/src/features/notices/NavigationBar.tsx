/**
 * Simple nav bar for notice detail/list screens with a back button.
 */

import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SdsColors } from '@skkuverse/shared';
import { Navbar } from '@skkuverse/sds';

interface Props {
  title: string;
}

export function NoticeNavBar({ title }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Navbar
        left={<Navbar.BackButton onPress={() => router.back()} />}
        title={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SdsColors.background,
  },
});
