/**
 * Custom navigation bar for bus screens — back button + title + optional info.
 *
 * Flutter source: bus_realtime_screen.dart (appBar section)
 */

import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors } from '@skkuverse/shared';
import { Navbar } from '@skkuverse/sds';

interface NavigationBarProps {
  title: string;
  onInfoPress?: () => void;
}

export function NavigationBar({ title, onInfoPress }: NavigationBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Navbar
        left={<Navbar.BackButton onPress={() => router.back()} />}
        title={title}
        right={
          onInfoPress ? (
            <Navbar.TextButton onPress={onInfoPress}>
              <MaterialIcons name="info-outline" size={24} color={SdsColors.grey900} />
            </Navbar.TextButton>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SdsColors.background,
  },
});
