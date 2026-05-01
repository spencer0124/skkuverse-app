import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BadgeNavRow } from '@skkuverse/sds';
import { SdsColors, useT } from '@skkuverse/shared';

export function LicensesScreen() {
  const router = useRouter();
  const { t } = useT();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BadgeNavRow
          badge="📄"
          tossface
          title={t('settings.tos')}
          onPress={() => router.push('/settings/licenses/tos' as never)}
        />
        <BadgeNavRow
          badge="🔗"
          tossface
          title={t('settings.attributions')}
          onPress={() => router.push('/settings/licenses/attributions' as never)}
        />
        <BadgeNavRow
          badge="📦"
          tossface
          title={t('settings.licensesOss')}
          onPress={() => router.push('/settings/licenses/oss' as never)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
});
