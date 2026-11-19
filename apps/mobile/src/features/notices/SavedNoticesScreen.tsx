import { FlatList, View } from 'react-native';
import { Stack } from 'expo-router';
import { createThemedStyles } from '@skkuverse/sds';
import { logNoticesContentSelect } from '@/platform/analytics';
import { NoticeRow } from './NoticeRow';
import { NoticeEmptyState } from './NoticeEmptyState';
import { NoticeLoginGate } from './components/NoticeLoginGate';
import { toBoardName } from './notices.rules';
import { useSavedNotices } from './useSavedNotices';

/**
 * WHY: one flat list by `savedAt`, never bucketed by publish date, which scrambles a save list's order.
 * Sign-out clears the store, so the next user on a shared device never sees the last one's bookmarks.
 */
export function SavedNoticesScreen() {
  const styles = useStyles();
  const { t, router, isAnonymous, items, tabsConfig } = useSavedNotices();

  if (isAnonymous) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('notices.saved') }} />
        <NoticeLoginGate
          description={t('notices.authRequired')}
          onLoginPress={() => router.push('/login')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('notices.saved') }} />
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NoticeRow
            item={item}
            onPress={(n) => {
              logNoticesContentSelect({
                content_type: 'list_row',
                item_id: `${n.sourceId}/${n.articleNo}`,
              });
              router.push(`/notices/${n.sourceId}/${n.articleNo}` as never);
            }}
            board={toBoardName(tabsConfig, item)}
          />
        )}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={
          <NoticeEmptyState
            message={t('notices.savedEmpty')}
          />
        }
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  list: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
}));
