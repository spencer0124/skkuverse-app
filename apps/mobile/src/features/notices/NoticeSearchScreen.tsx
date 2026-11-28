/**
 * QUIRK(rnscreens): a separate route, since UITabAccessory has no keyboard avoidance.
 */

import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeftIcon } from 'phosphor-react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, SearchField, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { logNoticesContentSelect } from '@/platform/analytics';
import { NoticeListPanel } from './NoticeListPanel';
import { NoticeListSkeleton } from './NoticeListSkeleton';
import { NoticeEmptyState } from './NoticeEmptyState';
import { useNoticeSearch } from './useNoticeSearch';

export function NoticeSearchScreen() {
  const styles = useStyles();
  const color = useSemanticColors();
  const insets = useSafeAreaInsets();
  const {
    router,
    t,
    placeholder,
    query,
    effectiveQuery,
    sourceIds,
    isTabsLoading,
    onChangeQuery,
  } = useNoticeSearch();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            logNoticesContentSelect({ content_type: 'search_back', item_id: 'back' });
            router.back();
          }}
          bg="transparent"
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <CaretLeftIcon size={26} color={color.fg.neutral} />
        </Pressable>
        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={onChangeQuery}
            placeholder={placeholder}
            hasClearButton
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {isTabsLoading ? (
        <NoticeListSkeleton />
      ) : effectiveQuery === undefined ? (
        // WHY: before the empty-scope guard, so a scopeless cold start also stays blank until the user types.
        <View style={styles.blank} />
      ) : sourceIds.length === 0 ? (
        // WHY: a cold start straight onto this route has no active tab, so there is no scope to search.
        <NoticeEmptyState
          message={t('notices.empty')}
          onRetry={() => router.back()}
        />
      ) : sourceIds.length === 1 ? (
        <NoticeListPanel
          sourceId={sourceIds[0]}
          q={effectiveQuery}
        />
      ) : (
        <NoticeListPanel
          sourceIds={sourceIds}
          q={effectiveQuery}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SdsSpacing.x3,
    paddingBottom: SdsSpacing.x3,
    gap: SdsSpacing.x1,
    backgroundColor: color.bg.layerDefault,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.full,
  },
  searchWrap: {
    flex: 1,
  },
  blank: {
    flex: 1,
  },
}));
