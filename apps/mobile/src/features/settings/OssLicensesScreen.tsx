import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SearchField, Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT } from '@skkuverse/shared';
import licensesData from '../../../assets/oss-licenses.json';

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  homepage: string | null;
  repository: string | null;
  author: string | null;
}

const PACKAGES = licensesData.packages as LicenseEntry[];

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  controlsColor: '#1A8A5C',
  toolbarColor: '#ffffff',
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

export function OssLicensesScreen() {
  const { t, tpl } = useT();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return PACKAGES;
    return PACKAGES.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.license.toLowerCase().includes(q)) return true;
      if (p.author && p.author.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [deferredQuery]);

  const isFiltering = deferredQuery.trim().length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SearchField
          placeholder={t('settings.licensesSearchPlaceholder')}
          value={query}
          onChangeText={setQuery}
          hasClearButton
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => <LicenseRow item={item} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.countHeader}>
            <Txt typography="t6" color={SdsColors.grey500}>
              {isFiltering
                ? tpl('settings.licensesCountFiltered', filtered.length, PACKAGES.length)
                : tpl('settings.licensesCount', PACKAGES.length)}
            </Txt>
          </View>
        }
        ListEmptyComponent={
          isFiltering ? (
            <View style={styles.empty}>
              <Txt typography="t5" color={SdsColors.grey500}>
                {t('settings.licensesEmpty')}
              </Txt>
            </View>
          ) : null
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        windowSize={10}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

function LicenseRow({ item }: { item: LicenseEntry }) {
  const url = item.homepage ?? item.repository;
  const onPress = url
    ? () => void WebBrowser.openBrowserAsync(url, inAppBrowserOptions)
    : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Txt typography="t5" fontWeight="medium" color={SdsColors.grey900}>
        {item.name}
      </Txt>
      <Txt typography="t7" color={SdsColors.grey500}>
        {`v${item.version} · ${item.license}`}
      </Txt>
    </Pressable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  searchWrap: {
    paddingHorizontal: SdsSpacing.lg,
    paddingTop: SdsSpacing.md,
    paddingBottom: SdsSpacing.sm,
  },
  content: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  countHeader: {
    paddingHorizontal: SdsSpacing.lg,
    paddingTop: SdsSpacing.xs,
    paddingBottom: SdsSpacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  row: {
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
    gap: 4,
  },
  rowPressed: {
    backgroundColor: SdsColors.grey50,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey100,
    marginLeft: SdsSpacing.lg,
  },
});
