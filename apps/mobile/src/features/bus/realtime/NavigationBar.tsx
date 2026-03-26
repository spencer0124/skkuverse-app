/**
 * Custom navigation bar for bus screens — back button + title + optional info.
 *
 * Flutter source: bus_realtime_screen.dart (appBar section)
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors, SdsTypo } from '@skkuuniverse/shared';

interface NavigationBarProps {
  title: string;
  onInfoPress?: () => void;
}

export function NavigationBar({ title, onInfoPress }: NavigationBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={24} color={SdsColors.grey900} />
        </Pressable>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {onInfoPress ? (
          <Pressable
            onPress={onInfoPress}
            style={styles.iconButton}
            hitSlop={8}
          >
            <MaterialIcons
              name="info-outline"
              size={24}
              color={SdsColors.grey900}
            />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SdsColors.background,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: SdsTypo.t6.fontSize,
    lineHeight: SdsTypo.t6.lineHeight,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
});
