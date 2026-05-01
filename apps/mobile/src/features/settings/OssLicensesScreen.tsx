import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Txt } from '@skkuverse/sds';
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

const PACKAGES = Array.from(
  new Map(
    (licensesData.packages as LicenseEntry[]).map((p) => [`${p.name}@${p.version}`, p]),
  ).values(),
);

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  controlsColor: '#1A8A5C',
  toolbarColor: '#ffffff',
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

export function OssLicensesScreen() {
  const { t } = useT();

  return (
    <FlatList
      style={styles.container}
      data={PACKAGES}
      keyExtractor={(item) => `${item.name}@${item.version}`}
      renderItem={({ item }) => <LicenseRow item={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Txt typography="t6" color={SdsColors.grey600}>
            {t('settings.ossNotice')}
          </Txt>
          <View style={styles.divider} />
        </View>
      }
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      initialNumToRender={20}
      windowSize={10}
      removeClippedSubviews
    />
  );
}

function LicenseRow({ item }: { item: LicenseEntry }) {
  const url = item.homepage ?? item.repository;

  return (
    <View style={styles.row}>
      <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
        {item.name}
      </Txt>
      {url ? (
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(url, inAppBrowserOptions)}>
          <Txt typography="t6" color={SdsColors.brand} style={styles.link}>
            {url}
          </Txt>
        </Pressable>
      ) : null}
      {item.author ? (
        <Txt typography="t6" color={SdsColors.grey500}>
          {item.author}
        </Txt>
      ) : null}
      <Txt typography="t6" color={SdsColors.grey500}>
        {`▶ ${item.license}`}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: SdsSpacing.lg,
    paddingTop: SdsSpacing.md,
    paddingBottom: SdsSpacing.lg,
    gap: SdsSpacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey200,
  },
  row: {
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
    gap: SdsSpacing.xxs,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
